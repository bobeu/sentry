// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentryWallet
 * @notice Manager-controlled custody for one identity and one immutable payment currency.
 * @dev Users cannot move wallet funds directly. EmploymentManager is the sole authority.
 */
contract SentryWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Assets supported by the wallet.
    enum Token {
        CELO,
        USDm,
        USDC,
        USDT
    }

    /// @notice Private identity commitment associated with this wallet.
    bytes32 public immutable identityHash;

    /// @notice Manager authorized to execute settlements.
    address public immutable manager;

    /// @notice Currency permanently assigned when the wallet is deployed.
    Token public immutable paymentCurrency;

    /// @notice ERC20 contract for paymentCurrency, or zero for native CELO.
    address public immutable tokenAddress;

    /// @notice Emitted when native CELO is received.
    /// @param from Sender of the funds.
    /// @param amount Amount received.
    event NativeReceived(address indexed from, uint256 amount);

    /// @notice Emitted after the manager executes a user withdrawal.
    /// @param to Recipient of the withdrawal.
    /// @param token Asset withdrawn.
    /// @param amount Amount withdrawn.
    /// @param withdrawalId Unique withdrawal identifier.
    event Withdrawal(
        address indexed to,
        Token indexed token,
        uint256 amount,
        bytes32 indexed withdrawalId
    );

    /// @notice Emitted after the manager executes a settlement.
    /// @param treasury Settlement recipient.
    /// @param token Settled asset.
    /// @param amount Total settlement amount.
    /// @param settlementId Unique settlement identifier.
    event SettlementExecuted(
        address indexed treasury,
        Token indexed token,
        uint256 amount,
        bytes32 indexed settlementId
    );

    /// @notice Caller is not the employment manager.
    error UnauthorizedManager();

    /// @notice Address argument cannot be zero.
    error ZeroAddress();

    /// @notice Identity hash cannot be zero.
    error InvalidIdentity();

    /// @notice Amount must be greater than zero.
    error InvalidAmount();

    /// @notice Native CELO transfer failed.
    error NativeTransferFailed();

    /// @dev Restricts settlement execution to EmploymentManager.
    modifier onlyManager() {
        if (msg.sender != manager) revert UnauthorizedManager();
        _;
    }

    /**
     * @notice Creates a manager-controlled wallet for one identity and currency.
     * @param employmentManager Manager authorized to settle funds.
     * @param identityHash_ Namespaced identity commitment.
     * @param currency_ Immutable wallet currency.
     * @param tokenAddress_ ERC20 address, or zero for CELO.
     */
    constructor(
        address employmentManager,
        bytes32 identityHash_,
        Token currency_,
        address tokenAddress_
    ) {
        if (employmentManager == address(0)) revert ZeroAddress();
        if (identityHash_ == bytes32(0)) revert InvalidIdentity();
        if (currency_ == Token.CELO && tokenAddress_ != address(0)) revert InvalidTokenConfig();
        if (currency_ != Token.CELO && tokenAddress_ == address(0)) revert InvalidTokenConfig();

        manager = employmentManager;
        identityHash = identityHash_;
        paymentCurrency = currency_;
        tokenAddress = tokenAddress_;
    }

    /// @notice Accepts native CELO transfers.
    receive() external payable {
        if (paymentCurrency != Token.CELO) revert InvalidTokenConfig();
        emit NativeReceived(msg.sender, msg.value);
    }

    /// @notice Returns the balance of the wallet's immutable currency.
    function balance() external view returns (uint256) {
        if (paymentCurrency == Token.CELO) return address(this).balance;
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /**
     * @notice Transfers an authorized batch settlement to the treasury.
     * @dev Replay protection and employment validation are enforced by EmploymentManager.
     * @param treasury Settlement recipient.
     * @param amount Service amount plus settlement fee.
     * @param settlementId Unique settlement identifier.
     */
    function executeSettlement(
        address treasury,
        uint256 amount,
        bytes32 settlementId
    ) external onlyManager nonReentrant {
        if (treasury == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        _transfer(treasury, amount);
        emit SettlementExecuted(treasury, paymentCurrency, amount, settlementId);
    }

    /**
     * @notice Transfers available funds to a user destination.
     * @param destination Registered withdrawal destination.
     * @param amount Amount to transfer.
     * @param withdrawalId Unique withdrawal identifier.
     */
    function withdrawTo(
        address destination,
        uint256 amount,
        bytes32 withdrawalId
    ) external onlyManager nonReentrant {
        if (destination == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _transfer(destination, amount);
        emit Withdrawal(destination, paymentCurrency, amount, withdrawalId);
    }

    /// @notice Token configuration does not match the selected currency.
    error InvalidTokenConfig();

    function _transfer(address destination, uint256 amount) private {
        if (paymentCurrency == Token.CELO) {
            (bool ok, ) = payable(destination).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(tokenAddress).safeTransfer(destination, amount);
        }
    }
}
