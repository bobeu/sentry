// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SentryWallet} from "./SentryWallet.sol";

/**
 * @title EmploymentManager
 * @notice Coordinates employment state and authorized batch settlements.
 * @dev The manager never holds user funds; each SentryWallet transfers directly to treasury.
 */
contract EmploymentManager is Ownable, Pausable {
    /// @notice Employment lifecycle states.
    enum EmploymentStatus {
        Inactive,
        Active,
        Paused,
        Exhausted
    }

    /// @notice Assets supported by SentryWallet.
    enum Token {
        CELO,
        USDm,
        USDC,
        USDT
    }

    /**
     * @notice Packed employment data.
     * @param wallet Registered SentryWallet.
     * @param lastSettlementAt Timestamp of the last successful settlement.
     * @param status Current employment lifecycle state.
     */
    struct Employment {
        address wallet;
        uint64 lastSettlementAt;
        EmploymentStatus status;
    }

    /// @notice Destination for service revenue and reimbursed settlement fees.
    address public treasury;

    /// @notice Account authorized to manage employment and execute settlements.
    address public operator;

    /// @notice Asset used for new settlements.
    Token public activePaymentToken;

    /// @notice Employment indexed by user.
    mapping(address user => Employment employment) public employments;

    /// @notice User indexed by registered wallet; also enforces one employment per wallet.
    mapping(address wallet => address user) public userOfWallet;

    /// @notice On-chain replay protection for settlement identifiers.
    mapping(bytes32 settlementId => bool settled) public settledBatches;

    /// @notice Emitted when an employment is registered and activated.
    /// @param user User who owns the employment.
    /// @param wallet Validated SentryWallet for the user.
    event EmploymentRegistered(address indexed user, address indexed wallet);

    /// @notice Emitted when an employment is paused.
    /// @param user Employment owner.
    event EmploymentPaused(address indexed user);

    /// @notice Emitted when an employment is resumed.
    /// @param user Employment owner.
    event EmploymentResumed(address indexed user);

    /// @notice Emitted when an employment is exhausted.
    /// @param user Employment owner.
    event EmploymentExhausted(address indexed user);

    /// @notice Emitted after a batch settlement succeeds.
    /// @param user Employment owner.
    /// @param wallet Wallet that paid the settlement.
    /// @param settlementId Unique settlement identifier.
    /// @param serviceAmount Service revenue.
    /// @param settlementFee Reimbursed transaction fee.
    event SettlementCompleted(
        address indexed user,
        address indexed wallet,
        bytes32 indexed settlementId,
        uint256 serviceAmount,
        uint256 settlementFee
    );

    /// @notice Emitted when the active payment token changes.
    /// @param previousToken Previous token.
    /// @param newToken New token.
    event PaymentCurrencyChanged(Token indexed previousToken, Token indexed newToken);

    /// @notice Emitted when the settlement operator changes.
    /// @param previousOperator Previous operator.
    /// @param newOperator New operator.
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);

    /// @notice Emitted when the treasury changes.
    /// @param previousTreasury Previous treasury.
    /// @param newTreasury New treasury.
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    /// @notice Caller is not the configured operator.
    error UnauthorizedOperator();

    /// @notice Address argument cannot be zero.
    error ZeroAddress();

    /// @notice Wallet is not a valid SentryWallet for the supplied user.
    error InvalidWallet();

    /// @notice User or wallet already has an employment.
    error EmploymentAlreadyRegistered();

    /// @notice Settlement identifier was already used.
    error AlreadySettled();

    /// @notice Employment is not in the required state.
    error InvalidStatus();

    /// @notice Settlement identifier cannot be zero.
    error InvalidSettlementId();

    /// @notice Service amount must be greater than zero.
    error InvalidAmount();

    /// @dev Restricts operator functions.
    modifier onlyOperator() {
        if (msg.sender != operator) revert UnauthorizedOperator();
        _;
    }

    /**
     * @notice Configures manager administration and settlement destination.
     * @param initialOwner Contract owner.
     * @param initialOperator Employment and settlement operator.
     * @param initialTreasury Settlement recipient.
     */
    constructor(
        address initialOwner,
        address initialOperator,
        address initialTreasury
    ) Ownable(initialOwner) {
        if (initialOperator == address(0) || initialTreasury == address(0)) {
            revert ZeroAddress();
        }
        operator = initialOperator;
        treasury = initialTreasury;
        activePaymentToken = Token.USDm;
        emit OperatorUpdated(address(0), initialOperator);
        emit TreasuryUpdated(address(0), initialTreasury);
    }

    /**
     * @notice Registers and activates a validated SentryWallet employment.
     * @param user Wallet owner.
     * @param wallet SentryWallet managed by this contract.
     */
    function registerEmployment(
        address user,
        address wallet
    ) external onlyOwner whenNotPaused {
        if (user == address(0) || wallet == address(0)) revert ZeroAddress();
        if (
            employments[user].wallet != address(0) ||
            userOfWallet[wallet] != address(0)
        ) revert EmploymentAlreadyRegistered();
        if (wallet.code.length == 0) revert InvalidWallet();

        SentryWallet sentryWallet = SentryWallet(payable(wallet));
        if (sentryWallet.manager() != address(this) || sentryWallet.owner() != user) {
            revert InvalidWallet();
        }

        employments[user] = Employment({
            wallet: wallet,
            lastSettlementAt: uint64(block.timestamp),
            status: EmploymentStatus.Active
        });
        userOfWallet[wallet] = user;

        emit EmploymentRegistered(user, wallet);
    }

    /**
     * @notice Changes the asset used for settlements.
     * @param token New payment token.
     */
    function setPaymentToken(Token token) external onlyOwner {
        Token previousToken = activePaymentToken;
        if (token == previousToken) return;
        activePaymentToken = token;
        emit PaymentCurrencyChanged(previousToken, token);
    }

    /**
     * @notice Pauses an active employment.
     * @param user Employment owner.
     */
    function pauseEmployment(address user) external onlyOperator whenNotPaused {
        Employment storage employment = employments[user];
        if (employment.status != EmploymentStatus.Active) revert InvalidStatus();
        employment.status = EmploymentStatus.Paused;
        emit EmploymentPaused(user);
    }

    /**
     * @notice Resumes a paused employment.
     * @param user Employment owner.
     */
    function resumeEmployment(address user) external onlyOperator whenNotPaused {
        Employment storage employment = employments[user];
        if (employment.status != EmploymentStatus.Paused) revert InvalidStatus();
        employment.status = EmploymentStatus.Active;
        emit EmploymentResumed(user);
    }

    /**
     * @notice Marks an active or paused employment as exhausted.
     * @param user Employment owner.
     */
    function exhaustEmployment(address user) external onlyOperator whenNotPaused {
        Employment storage employment = employments[user];
        if (
            employment.status != EmploymentStatus.Active &&
            employment.status != EmploymentStatus.Paused
        ) revert InvalidStatus();
        employment.status = EmploymentStatus.Exhausted;
        emit EmploymentExhausted(user);
    }

    /**
     * @notice Executes one replay-protected settlement from a user's wallet.
     * @param user Employment owner.
     * @param settlementId Unique settlement identifier.
     * @param serviceAmount Service revenue.
     * @param settlementFee Fee reimbursed to the treasury.
     */
    function chargeSettlement(
        address user,
        bytes32 settlementId,
        uint256 serviceAmount,
        uint256 settlementFee
    ) external onlyOperator whenNotPaused {
        if (settlementId == bytes32(0)) revert InvalidSettlementId();
        if (serviceAmount == 0) revert InvalidAmount();
        if (settledBatches[settlementId]) revert AlreadySettled();

        Employment storage employment = employments[user];
        if (employment.wallet == address(0) || userOfWallet[employment.wallet] != user) {
            revert InvalidWallet();
        }
        if (employment.status != EmploymentStatus.Active) revert InvalidStatus();

        uint256 total = serviceAmount + settlementFee;

        // Effects precede interaction; a failed wallet transfer reverts these writes.
        settledBatches[settlementId] = true;
        employment.lastSettlementAt = uint64(block.timestamp);

        SentryWallet(payable(employment.wallet)).executeSettlement(
            SentryWallet.Token(uint8(activePaymentToken)),
            treasury,
            total,
            settlementId
        );

        emit SettlementCompleted(
            user,
            employment.wallet,
            settlementId,
            serviceAmount,
            settlementFee
        );
    }

    /**
     * @notice Returns the wallet for a user.
     * @param user Employment owner.
     * @return wallet Registered wallet or zero address.
     */
    function walletOf(address user) external view returns (address wallet) {
        return employments[user].wallet;
    }

    /**
     * @notice Returns the employment state for a user.
     * @param user Employment owner.
     * @return status Current employment status.
     */
    function employmentStatus(
        address user
    ) external view returns (EmploymentStatus status) {
        return employments[user].status;
    }

    /**
     * @notice Updates the settlement operator.
     * @param newOperator New operator.
     */
    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        address previousOperator = operator;
        if (newOperator == previousOperator) return;
        operator = newOperator;
        emit OperatorUpdated(previousOperator, newOperator);
    }

    /**
     * @notice Updates the settlement treasury.
     * @param newTreasury New treasury.
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address previousTreasury = treasury;
        if (newTreasury == previousTreasury) return;
        treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    /// @notice Pauses employment state changes and settlements.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes employment state changes and settlements.
    function unpause() external onlyOwner {
        _unpause();
    }
}
