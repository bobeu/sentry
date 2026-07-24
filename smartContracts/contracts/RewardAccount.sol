// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RewardAccount
 * @notice Factory-mediated multi-currency custody for community engagement rewards.
 * @dev Holds CELO + USDm + USDC + USDT. Employer funds by transfer; privileged ops via RewardFactory.
 */
contract RewardAccount is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Token {
        CELO,
        USDm,
        USDC,
        USDT
    }

    enum AccountStatus {
        Provisioning,
        Active,
        Paused,
        Archived
    }

    uint256 public constant VERSION = 2;

    /// @notice Factory that deployed this account (sole authorized caller for privileged ops).
    address public immutable factory;

    /// @notice Employer who receives surplus when operator withdraws via factory.
    address public immutable employer;

    /// @notice Group / campaign identity commitment (e.g. keccak of telegram group id).
    bytes32 public immutable accountKey;

    /// @notice ERC20 addresses snapshotted at deploy (CELO uses address(0)).
    address public immutable usdmToken;
    address public immutable usdcToken;
    address public immutable usdtToken;

    /// @notice Cached operator mirror (rotated only via factory).
    address public operator;

    /// @notice Lifecycle state.
    AccountStatus public status;

    /// @notice Replay protection for payout identifiers.
    mapping(bytes32 payoutId => bool processed) public processedPayouts;

    event NativeReceived(address indexed from, uint256 amount);
    event AccountFunded(
        address indexed account,
        address indexed from,
        uint256 amount,
        Token currency
    );
    event RewardPaid(
        address indexed to,
        Token indexed token,
        uint256 amount,
        bytes32 indexed payoutId
    );
    event WithdrawnToEmployer(address indexed employer, Token indexed token, uint256 amount);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event AccountStatusChanged(AccountStatus indexed previousStatus, AccountStatus indexed newStatus);

    error UnauthorizedFactory();
    error ZeroAddress();
    error InvalidAccountKey();
    error InvalidAmount();
    error NativeTransferFailed();
    error InvalidTokenConfig();
    error InvalidAccountStatus();
    error PayoutAlreadyProcessed();
    error InsufficientReserve();
    error NothingToWithdraw();

    modifier onlyFactory() {
        if (msg.sender != factory) revert UnauthorizedFactory();
        _;
    }

    modifier onlyActive() {
        if (status != AccountStatus.Active) revert InvalidAccountStatus();
        _;
    }

    constructor(
        address factory_,
        address operator_,
        address employer_,
        bytes32 accountKey_,
        address usdm_,
        address usdc_,
        address usdt_
    ) {
        if (factory_ == address(0) || operator_ == address(0) || employer_ == address(0)) {
            revert ZeroAddress();
        }
        if (accountKey_ == bytes32(0)) revert InvalidAccountKey();
        if (usdm_ == address(0) || usdc_ == address(0) || usdt_ == address(0)) {
            revert InvalidTokenConfig();
        }

        factory = factory_;
        operator = operator_;
        employer = employer_;
        accountKey = accountKey_;
        usdmToken = usdm_;
        usdcToken = usdc_;
        usdtToken = usdt_;
        status = AccountStatus.Provisioning;
    }

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
        emit AccountFunded(address(this), msg.sender, msg.value, Token.CELO);
    }

    function balance(Token currency) public view returns (uint256) {
        if (currency == Token.CELO) return address(this).balance;
        return IERC20(_tokenAddress(currency)).balanceOf(address(this));
    }

    function balances()
        external
        view
        returns (uint256 celoBal, uint256 usdmBal, uint256 usdcBal, uint256 usdtBal)
    {
        celoBal = address(this).balance;
        usdmBal = IERC20(usdmToken).balanceOf(address(this));
        usdcBal = IERC20(usdcToken).balanceOf(address(this));
        usdtBal = IERC20(usdtToken).balanceOf(address(this));
    }

    function tokenAddress(Token currency) external view returns (address) {
        if (currency == Token.CELO) return address(0);
        return _tokenAddress(currency);
    }

    function setOperator(address newOperator) external onlyFactory {
        if (newOperator == address(0)) revert ZeroAddress();
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    function activate() external onlyFactory {
        if (status != AccountStatus.Provisioning && status != AccountStatus.Paused) {
            revert InvalidAccountStatus();
        }
        _setStatus(AccountStatus.Active);
    }

    function pause() external onlyFactory {
        if (status != AccountStatus.Active) revert InvalidAccountStatus();
        _setStatus(AccountStatus.Paused);
    }

    function resume() external onlyFactory {
        if (status != AccountStatus.Paused) revert InvalidAccountStatus();
        _setStatus(AccountStatus.Active);
    }

    function archive() external onlyFactory {
        if (status == AccountStatus.Archived) revert InvalidAccountStatus();
        _setStatus(AccountStatus.Archived);
    }

    function notifyFunding(address from, uint256 amount, Token currency) external onlyFactory {
        if (amount == 0) revert InvalidAmount();
        emit AccountFunded(address(this), from, amount, currency);
    }

    /**
     * @notice Pays a reward in the specified currency. Replay-protected by payoutId.
     */
    function payout(
        address to,
        uint256 amount,
        bytes32 payoutId,
        Token currency
    ) external onlyFactory onlyActive nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (payoutId == bytes32(0)) revert InvalidAmount();
        if (processedPayouts[payoutId]) revert PayoutAlreadyProcessed();

        processedPayouts[payoutId] = true;
        _transfer(currency, to, amount);
        emit RewardPaid(to, currency, amount, payoutId);
    }

    /**
     * @notice Sends surplus (balance minus pending reserves) of each currency to employer.
     * @dev Active or Paused only. Reverts if any pending exceeds on-chain balance.
     */
    function withdrawAllToEmployer(
        uint256 pendingCELO,
        uint256 pendingUSDm,
        uint256 pendingUSDC,
        uint256 pendingUSDT
    ) external onlyFactory nonReentrant returns (uint256 totalSent) {
        if (status == AccountStatus.Archived || status == AccountStatus.Provisioning) {
            revert InvalidAccountStatus();
        }

        totalSent += _withdrawSurplus(Token.CELO, pendingCELO);
        totalSent += _withdrawSurplus(Token.USDm, pendingUSDm);
        totalSent += _withdrawSurplus(Token.USDC, pendingUSDC);
        totalSent += _withdrawSurplus(Token.USDT, pendingUSDT);

        if (totalSent == 0) revert NothingToWithdraw();
    }

    function _withdrawSurplus(Token currency, uint256 pending) private returns (uint256 sent) {
        uint256 bal = balance(currency);
        if (pending > bal) revert InsufficientReserve();
        sent = bal - pending;
        if (sent == 0) return 0;
        _transfer(currency, employer, sent);
        emit WithdrawnToEmployer(employer, currency, sent);
    }

    function _setStatus(AccountStatus newStatus) private {
        AccountStatus previousStatus = status;
        if (previousStatus == newStatus) revert InvalidAccountStatus();
        status = newStatus;
        emit AccountStatusChanged(previousStatus, newStatus);
    }

    function _tokenAddress(Token currency) private view returns (address) {
        if (currency == Token.USDm) return usdmToken;
        if (currency == Token.USDC) return usdcToken;
        if (currency == Token.USDT) return usdtToken;
        revert InvalidTokenConfig();
    }

    function _transfer(Token currency, address destination, uint256 amount) private {
        if (currency == Token.CELO) {
            (bool ok, ) = payable(destination).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(_tokenAddress(currency)).safeTransfer(destination, amount);
        }
    }
}
