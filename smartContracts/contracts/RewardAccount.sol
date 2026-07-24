// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RewardAccount
 * @notice Factory-mediated custody for community engagement rewards (one account per group key).
 * @dev Independent of EmploymentManager / SentryWallet. Employer funds by transfer; all operator
 *      actions (payout, pause, withdraw-to-employer) go through RewardFactory only.
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

    uint256 public constant VERSION = 1;

    /// @notice Factory that deployed this account (sole authorized caller for privileged ops).
    address public immutable factory;

    /// @notice Employer who receives full balance when operator withdraws via factory.
    address public immutable employer;

    /// @notice Group / campaign identity commitment (e.g. keccak of telegram group id).
    bytes32 public immutable accountKey;

    /// @notice Immutable reward asset for this account.
    Token public immutable rewardCurrency;

    /// @notice ERC20 for rewardCurrency, or zero for native CELO.
    address public immutable tokenAddress;

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
        Token currency_,
        address tokenAddress_
    ) {
        if (factory_ == address(0) || operator_ == address(0) || employer_ == address(0)) {
            revert ZeroAddress();
        }
        if (accountKey_ == bytes32(0)) revert InvalidAccountKey();
        if (currency_ == Token.CELO && tokenAddress_ != address(0)) revert InvalidTokenConfig();
        if (currency_ != Token.CELO && tokenAddress_ == address(0)) revert InvalidTokenConfig();

        factory = factory_;
        operator = operator_;
        employer = employer_;
        accountKey = accountKey_;
        rewardCurrency = currency_;
        tokenAddress = tokenAddress_;
        status = AccountStatus.Provisioning;
    }

    receive() external payable {
        if (rewardCurrency != Token.CELO) revert InvalidTokenConfig();
        emit NativeReceived(msg.sender, msg.value);
        emit AccountFunded(address(this), msg.sender, msg.value, rewardCurrency);
    }

    function balance() public view returns (uint256) {
        if (rewardCurrency == Token.CELO) return address(this).balance;
        return IERC20(tokenAddress).balanceOf(address(this));
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

    function notifyFunding(address from, uint256 amount) external onlyFactory {
        if (amount == 0) revert InvalidAmount();
        emit AccountFunded(address(this), from, amount, rewardCurrency);
    }

    /**
     * @notice Pays a reward to a member wallet. Replay-protected by payoutId.
     * @dev Only callable by RewardFactory (operator calls factory.payout).
     */
    function payout(
        address to,
        uint256 amount,
        bytes32 payoutId
    ) external onlyFactory onlyActive nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (payoutId == bytes32(0)) revert InvalidAmount();
        if (processedPayouts[payoutId]) revert PayoutAlreadyProcessed();

        processedPayouts[payoutId] = true;
        _transfer(to, amount);
        emit RewardPaid(to, rewardCurrency, amount, payoutId);
    }

    /**
     * @notice Sends the full account balance to the immutable employer.
     * @dev Active or Paused only; archived accounts cannot withdraw.
     */
    function withdrawAllToEmployer() external onlyFactory nonReentrant returns (uint256 amount) {
        if (status == AccountStatus.Archived || status == AccountStatus.Provisioning) {
            revert InvalidAccountStatus();
        }
        amount = balance();
        if (amount == 0) revert InvalidAmount();
        _transfer(employer, amount);
        emit WithdrawnToEmployer(employer, rewardCurrency, amount);
    }

    function _setStatus(AccountStatus newStatus) private {
        AccountStatus previousStatus = status;
        if (previousStatus == newStatus) revert InvalidAccountStatus();
        status = newStatus;
        emit AccountStatusChanged(previousStatus, newStatus);
    }

    function _transfer(address destination, uint256 amount) private {
        if (rewardCurrency == Token.CELO) {
            (bool ok, ) = payable(destination).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(tokenAddress).safeTransfer(destination, amount);
        }
    }
}
