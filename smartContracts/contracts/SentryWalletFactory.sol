// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SentryWallet} from "./SentryWallet.sol";

/**
 * @title SentryWalletFactory
 * @notice Deploys exactly one SentryWallet for each identity and user key.
 * @dev Uses CREATE deliberately. Future wallet implementations only require updating
 *      `walletVersion` and the deployment target in this factory — no in-place upgrades.
 */
contract SentryWalletFactory is Ownable {
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

    /// @notice Emitted after a wallet is created and indexed.
    /// @param identityHash Identity commitment assigned to the wallet.
    /// @param userKey Stable user identifier.
    /// @param currency Immutable wallet currency.
    /// @param wallet Deployed SentryWallet address.
    event WalletCreated(
        bytes32 indexed identityHash,
        address indexed userKey,
        Token currency,
        address indexed wallet
    );

    /// @notice Emitted when a currency is enabled or disabled for future wallets.
    /// @param currency Currency configuration changed.
    /// @param enabled New enabled state.
    event CurrencyEnabled(Token indexed currency, bool enabled);
    event TokenAddressUpdated(
        Token indexed currency,
        address indexed previousAddress,
        address indexed newAddress
    );

    /// @notice An identity already has a wallet.
    error IdentityAlreadyRegistered();

    /// @notice An owner already has a wallet.
    error OwnerAlreadyRegistered();

    /// @notice Address argument cannot be zero.
    error ZeroAddress();

    /// @notice Identity hash cannot be zero.
    error InvalidIdentity();
    error CurrencyDisabled();
    error InvalidTokenConfig();

    /// @notice EmploymentManager assigned to every deployed wallet.
    address public immutable manager;

    /// @notice Version of SentryWallet deployed by this factory.
    uint256 public walletVersion = 1;

    mapping(Token currency => CurrencyConfig config) public currencies;

    /// @notice Wallet indexed by identity commitment.
    mapping(bytes32 identityHash => address wallet) public walletOfIdentity;

    /// @notice Wallet indexed by owner.
    mapping(address userKey => address wallet) public walletOfUser;

    /// @notice Identity commitment indexed by wallet.
    mapping(address wallet => bytes32 identityHash) public identityOfWallet;

    /**
     * @notice Configures the wallet factory.
     * @param initialOwner Account authorized to create wallets and update token addresses.
     * @param employmentManager Manager assigned to new wallets.
     * @param usdm_ Initial USDm token address.
     * @param usdc_ Initial USDC token address.
     * @param usdt_ Initial USDT token address.
     */
    constructor(
        address initialOwner,
        address employmentManager,
        address usdm_,
        address usdc_,
        address usdt_
    ) Ownable(initialOwner) {
        _validateAddresses(employmentManager, usdm_, usdc_, usdt_);
        manager = employmentManager;
        currencies[Token.CELO] = CurrencyConfig(address(0), true);
        currencies[Token.USDm] = CurrencyConfig(usdm_, true);
        currencies[Token.USDC] = CurrencyConfig(usdc_, true);
        currencies[Token.USDT] = CurrencyConfig(usdt_, true);
    }

    /**
     * @notice Creates and indexes a wallet.
     * @param identityHash Identity commitment for the user.
     * @param userKey Stable on-chain user identifier.
     * @param currency Immutable currency selected for the wallet.
     * @return wallet Address of the deployed wallet.
     */
    function createWallet(
        bytes32 identityHash,
        address userKey,
        Token currency
    ) external onlyOwner returns (address wallet) {
        if (userKey == address(0)) revert ZeroAddress();
        if (identityHash == bytes32(0)) revert InvalidIdentity();
        if (walletOfIdentity[identityHash] != address(0)) revert IdentityAlreadyRegistered();
        if (walletOfUser[userKey] != address(0)) revert OwnerAlreadyRegistered();

        CurrencyConfig memory config = currencies[currency];
        if (!config.enabled) revert CurrencyDisabled();
        if (currency != Token.CELO && config.tokenAddress == address(0)) {
            revert InvalidTokenConfig();
        }

        wallet = address(new SentryWallet(
            manager,
            identityHash,
            SentryWallet.Token(uint8(currency)),
            config.tokenAddress
        ));

        walletOfIdentity[identityHash] = wallet;
        walletOfUser[userKey] = wallet;
        identityOfWallet[wallet] = identityHash;

        emit WalletCreated(identityHash, userKey, currency, wallet);
    }

    /**
     * @notice Checks whether an identity has a wallet.
     * @param identityHash Identity commitment to query.
     * @return exists True when a wallet is registered.
     */
    function hasWallet(bytes32 identityHash) external view returns (bool exists) {
        return walletOfIdentity[identityHash] != address(0);
    }

    /**
     * @notice Resolves a wallet from an identity.
     * @param identityHash Identity commitment to query.
     * @return wallet Registered wallet or zero address.
     */
    function walletFromIdentity(bytes32 identityHash) external view returns (address wallet) {
        return walletOfIdentity[identityHash];
    }

    /**
     * @notice Resolves a wallet from its stable user key.
     * @param userKey User key to query.
     * @return wallet Registered wallet or zero address.
     */
    function walletFromUser(address userKey) external view returns (address wallet) {
        return walletOfUser[userKey];
    }

    function setCurrencyEnabled(Token currency, bool enabled) external onlyOwner {
        CurrencyConfig storage config = currencies[currency];
        if (currency != Token.CELO && config.tokenAddress == address(0)) {
            revert InvalidTokenConfig();
        }
        if (config.enabled == enabled) return;
        config.enabled = enabled;
        emit CurrencyEnabled(currency, enabled);
    }

    function updateTokenAddress(Token currency, address newAddress) external onlyOwner {
        if (currency == Token.CELO || newAddress == address(0)) revert InvalidTokenConfig();
        CurrencyConfig storage config = currencies[currency];
        address previousAddress = config.tokenAddress;
        if (previousAddress == newAddress) return;
        config.tokenAddress = newAddress;
        emit TokenAddressUpdated(currency, previousAddress, newAddress);
    }

    /**
     * @dev Validates manager and token addresses.
     * @param employmentManager Manager address.
     * @param usdm_ USDm address.
     * @param usdc_ USDC address.
     * @param usdt_ USDT address.
     */
    function _validateAddresses(
        address employmentManager,
        address usdm_,
        address usdc_,
        address usdt_
    ) private pure {
        if (
            employmentManager == address(0) ||
            usdm_ == address(0) ||
            usdc_ == address(0) ||
            usdt_ == address(0)
        ) revert ZeroAddress();
    }
}
