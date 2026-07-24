// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { RewardAccount } from "./RewardAccount.sol";

/**
 * @title RewardFactory
 * @notice Deploys one RewardAccount per account key and is the sole gateway for operator actions.
 * @dev Standalone from SentryWalletFactory / EmploymentManager — no changes to those contracts.
 *      Owner: create/archive/currency/setAccountOperator. Operator: payout/notify/pause/resume/withdrawToEmployer.
 */
contract RewardFactory is Ownable {
    enum Token {
        CELO,
        USDm,
        USDC,
        USDT
    }

    struct CurrencyConfig {
        address tokenAddress;
        bool enabled;
    }

    event AccountCreated(
        bytes32 indexed accountKey,
        Token currency,
        address indexed account,
        address operator,
        address employer
    );
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event CurrencyEnabled(Token indexed currency, bool enabled);
    event TokenAddressUpdated(
        Token indexed currency,
        address indexed previousAddress,
        address indexed newAddress
    );

    error ZeroAddress();
    error InvalidAccountKey();
    error AccountAlreadyExists();
    error CurrencyDisabled();
    error InvalidTokenConfig();
    error UnknownAccount();
    error UnauthorizedOperator();

    /// @notice Sentry operator authorized for payout / pause / employer withdraw.
    address public operator;

    /// @notice Version of RewardAccount deployed by this factory.
    uint256 public accountVersion = 1;

    mapping(Token currency => CurrencyConfig config) public currencies;
    mapping(bytes32 accountKey => address account) public accountOfKey;
    mapping(address account => bytes32 accountKey) public keyOfAccount;

    modifier onlyOperator() {
        if (msg.sender != operator) revert UnauthorizedOperator();
        _;
    }

    constructor(
        address initialOwner,
        address initialOperator,
        address usdm_,
        address usdc_,
        address usdt_
    ) Ownable(initialOwner) {
        if (initialOperator == address(0)) revert ZeroAddress();
        _validateToken(usdm_);
        _validateToken(usdc_);
        _validateToken(usdt_);
        operator = initialOperator;
        currencies[Token.CELO] = CurrencyConfig(address(0), true);
        currencies[Token.USDm] = CurrencyConfig(usdm_, true);
        currencies[Token.USDC] = CurrencyConfig(usdc_, true);
        currencies[Token.USDT] = CurrencyConfig(usdt_, true);
    }

    function createAccount(
        bytes32 accountKey,
        Token currency,
        address employer
    ) external onlyOwner returns (address account) {
        if (accountKey == bytes32(0)) revert InvalidAccountKey();
        if (employer == address(0)) revert ZeroAddress();
        if (accountOfKey[accountKey] != address(0)) revert AccountAlreadyExists();

        CurrencyConfig memory config = currencies[currency];
        if (!config.enabled) revert CurrencyDisabled();
        if (currency == Token.CELO && config.tokenAddress != address(0)) revert InvalidTokenConfig();
        if (currency != Token.CELO && config.tokenAddress == address(0)) revert InvalidTokenConfig();

        RewardAccount deployed = new RewardAccount(
            address(this),
            operator,
            employer,
            accountKey,
            RewardAccount.Token(uint8(currency)),
            config.tokenAddress
        );
        account = address(deployed);
        accountOfKey[accountKey] = account;
        keyOfAccount[account] = accountKey;

        deployed.activate();
        emit AccountCreated(accountKey, currency, account, operator, employer);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    /// @notice Rotates operator on an existing account (owner executes).
    function setAccountOperator(bytes32 accountKey, address newOperator) external onlyOwner {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).setOperator(newOperator);
    }

    function pauseAccount(bytes32 accountKey) external onlyOwner {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).pause();
    }

    function resumeAccount(bytes32 accountKey) external onlyOwner {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).resume();
    }

    function archiveAccount(bytes32 accountKey) external onlyOwner {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).archive();
    }

    /// @notice Operator pause (routine Sentry ops).
    function pauseAccountByOperator(bytes32 accountKey) external onlyOperator {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).pause();
    }

    /// @notice Operator resume (routine Sentry ops).
    function resumeAccountByOperator(bytes32 accountKey) external onlyOperator {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).resume();
    }

    function payout(
        bytes32 accountKey,
        address to,
        uint256 amount,
        bytes32 payoutId
    ) external onlyOperator {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).payout(to, amount, payoutId);
    }

    function notifyFunding(
        bytes32 accountKey,
        address from,
        uint256 amount
    ) external onlyOperator {
        address account = _requireAccount(accountKey);
        RewardAccount(payable(account)).notifyFunding(from, amount);
    }

    /// @notice Operator withdraws full RewardAccount balance to the immutable employer.
    function withdrawToEmployer(bytes32 accountKey) external onlyOperator returns (uint256) {
        address account = _requireAccount(accountKey);
        return RewardAccount(payable(account)).withdrawAllToEmployer();
    }

    function setCurrencyEnabled(Token currency, bool enabled) external onlyOwner {
        currencies[currency].enabled = enabled;
        emit CurrencyEnabled(currency, enabled);
    }

    function updateTokenAddress(Token currency, address tokenAddress_) external onlyOwner {
        if (currency == Token.CELO) revert InvalidTokenConfig();
        _validateToken(tokenAddress_);
        address previous = currencies[currency].tokenAddress;
        currencies[currency].tokenAddress = tokenAddress_;
        emit TokenAddressUpdated(currency, previous, tokenAddress_);
    }

    function _requireAccount(bytes32 accountKey) private view returns (address account) {
        account = accountOfKey[accountKey];
        if (account == address(0)) revert UnknownAccount();
    }

    function _validateToken(address token) private pure {
        if (token == address(0)) revert ZeroAddress();
    }
}
