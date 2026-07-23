// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { RewardAccount } from "./RewardAccount.sol";

/**
 * @title RewardFactory
 * @notice Deploys one RewardAccount per account key (typically a Telegram group commitment).
 * @dev Standalone from SentryWalletFactory / EmploymentManager — no changes to existing contracts.
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
        address operator
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

    /// @notice Sentry operator assigned to newly created accounts.
    address public operator;

    /// @notice Version of RewardAccount deployed by this factory.
    uint256 public accountVersion = 1;

    mapping(Token currency => CurrencyConfig config) public currencies;
    mapping(bytes32 accountKey => address account) public accountOfKey;
    mapping(address account => bytes32 accountKey) public keyOfAccount;

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
        Token currency
    ) external onlyOwner returns (address account) {
        if (accountKey == bytes32(0)) revert InvalidAccountKey();
        if (accountOfKey[accountKey] != address(0)) revert AccountAlreadyExists();

        CurrencyConfig memory config = currencies[currency];
        if (!config.enabled) revert CurrencyDisabled();
        if (currency == Token.CELO && config.tokenAddress != address(0)) revert InvalidTokenConfig();
        if (currency != Token.CELO && config.tokenAddress == address(0)) revert InvalidTokenConfig();

        RewardAccount deployed = new RewardAccount(
            address(this),
            operator,
            accountKey,
            RewardAccount.Token(uint8(currency)),
            config.tokenAddress
        );
        account = address(deployed);
        accountOfKey[accountKey] = account;
        keyOfAccount[account] = accountKey;

        deployed.activate();
        emit AccountCreated(accountKey, currency, account, operator);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    /// @notice Rotates operator on an existing account (employer asks Sentry; owner executes).
    function setAccountOperator(bytes32 accountKey, address newOperator) external onlyOwner {
        address account = accountOfKey[accountKey];
        if (account == address(0)) revert UnknownAccount();
        RewardAccount(payable(account)).setOperator(newOperator);
    }

    function pauseAccount(bytes32 accountKey) external onlyOwner {
        address account = accountOfKey[accountKey];
        if (account == address(0)) revert UnknownAccount();
        RewardAccount(payable(account)).pause();
    }

    function resumeAccount(bytes32 accountKey) external onlyOwner {
        address account = accountOfKey[accountKey];
        if (account == address(0)) revert UnknownAccount();
        RewardAccount(payable(account)).resume();
    }

    function archiveAccount(bytes32 accountKey) external onlyOwner {
        address account = accountOfKey[accountKey];
        if (account == address(0)) revert UnknownAccount();
        RewardAccount(payable(account)).archive();
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

    function _validateToken(address token) private pure {
        if (token == address(0)) revert ZeroAddress();
    }
}
