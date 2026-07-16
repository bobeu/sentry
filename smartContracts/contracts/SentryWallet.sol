// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentryWallet
 * @notice Manager-controlled custody for one identity and one immutable payment currency.
 * @dev Users never move funds directly. EmploymentManager is the sole settlement and withdrawal authority.
 *      Wallet lifecycle (Provisioning → Active → Locked → Archived) is independent of employment status.
 */
contract SentryWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Supported payment assets.
    enum Token {
        CELO,
        USDm,
        USDC,
        USDT
    }

    /// @notice Wallet lifecycle states managed by EmploymentManager.
    enum WalletStatus {
        Provisioning,
        Active,
        Locked,
        Archived
    }

    /// @notice Immutable implementation version for indexers and future factory routing.
    uint256 public constant VERSION = 1;

    /// @notice Private identity commitment associated with this wallet.
    bytes32 public immutable identityHash;

    /// @notice Manager authorized to settle, withdraw, and manage lifecycle.
    address public immutable manager;

    /// @notice Currency permanently assigned when the wallet is deployed.
    Token public immutable paymentCurrency;

    /// @notice ERC20 contract for paymentCurrency, or zero for native CELO.
    address public immutable tokenAddress;

    /// @notice Current wallet lifecycle state.
    WalletStatus public status;

    /// @notice Emitted when native CELO is received.
    event NativeReceived(address indexed from, uint256 amount);

    /// @notice Emitted when funds are deposited or synchronized into the wallet.
    /// @param wallet This wallet address.
    /// @param from Funding source.
    /// @param amount Amount received in the wallet currency.
    /// @param currency Immutable wallet currency.
    event WalletFunded(
        address indexed wallet,
        address indexed from,
        uint256 amount,
        Token currency
    );

    /// @notice Emitted after the manager executes a user withdrawal.
    event Withdrawal(
        address indexed to,
        Token indexed token,
        uint256 amount,
        bytes32 indexed withdrawalId
    );

    /// @notice Emitted after the manager executes a settlement.
    event SettlementExecuted(
        address indexed treasury,
        Token indexed token,
        uint256 amount,
        bytes32 indexed settlementId
    );

    /// @notice Emitted when wallet lifecycle changes.
    event WalletStatusChanged(
        WalletStatus indexed previousStatus,
        WalletStatus indexed newStatus
    );

    error UnauthorizedManager();
    error ZeroAddress();
    error InvalidIdentity();
    error InvalidAmount();
    error NativeTransferFailed();
    error InvalidTokenConfig();
    error InvalidWalletStatus();

    modifier onlyManager() {
        if (msg.sender != manager) revert UnauthorizedManager();
        _;
    }

    modifier onlyActive() {
        if (status != WalletStatus.Active) revert InvalidWalletStatus();
        _;
    }

    /**
     * @notice Creates a manager-controlled wallet for one identity and currency.
     * @param employmentManager Manager authorized to settle funds and manage lifecycle.
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
        status = WalletStatus.Provisioning;
    }

    /// @notice Accepts native CELO transfers for CELO wallets.
    receive() external payable {
        if (paymentCurrency != Token.CELO) revert InvalidTokenConfig();
        emit NativeReceived(msg.sender, msg.value);
        emit WalletFunded(address(this), msg.sender, msg.value, paymentCurrency);
    }

    /// @notice Returns the balance of the wallet's immutable currency.
    function balance() external view returns (uint256) {
        if (paymentCurrency == Token.CELO) return address(this).balance;
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /// @notice Activates a newly provisioned wallet.
    function activate() external onlyManager {
        if (status != WalletStatus.Provisioning) revert InvalidWalletStatus();
        _setStatus(WalletStatus.Active);
    }

    /// @notice Locks an active wallet to block settlements and withdrawals.
    function lockWallet() external onlyManager {
        if (status != WalletStatus.Active) revert InvalidWalletStatus();
        _setStatus(WalletStatus.Locked);
    }

    /// @notice Unlocks a locked wallet.
    function unlockWallet() external onlyManager {
        if (status != WalletStatus.Locked) revert InvalidWalletStatus();
        _setStatus(WalletStatus.Active);
    }

    /// @notice Archives a wallet permanently.
    function archiveWallet() external onlyManager {
        if (status == WalletStatus.Archived) revert InvalidWalletStatus();
        _setStatus(WalletStatus.Archived);
    }

    /**
     * @notice Records an ERC20 funding event after backend synchronization.
     * @param from Funding source observed off-chain or on-chain.
     * @param amount Amount credited in the wallet currency.
     */
    function notifyFunding(address from, uint256 amount) external onlyManager {
        if (amount == 0) revert InvalidAmount();
        emit WalletFunded(address(this), from, amount, paymentCurrency);
    }

    /**
     * @notice Transfers an authorized batch settlement to the treasury.
     * @dev Replay protection and employment validation are enforced by EmploymentManager.
     */
    function executeSettlement(
        address treasury,
        uint256 amount,
        bytes32 settlementId
    ) external onlyManager onlyActive nonReentrant {
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
    ) external onlyManager onlyActive nonReentrant {
        if (destination == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _transfer(destination, amount);
        emit Withdrawal(destination, paymentCurrency, amount, withdrawalId);
    }

    function _setStatus(WalletStatus newStatus) private {
        WalletStatus previousStatus = status;
        if (previousStatus == newStatus) revert InvalidWalletStatus();
        status = newStatus;
        emit WalletStatusChanged(previousStatus, newStatus);
    }

    function _transfer(address destination, uint256 amount) private {
        if (paymentCurrency == Token.CELO) {
            (bool ok, ) = payable(destination).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(tokenAddress).safeTransfer(destination, amount);
        }
    }
}
