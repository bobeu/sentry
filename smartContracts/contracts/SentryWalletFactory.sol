// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SentryWallet} from "./SentryWallet.sol";

/**
 * @title SentryWalletFactory
 * @notice Deploys exactly one SentryWallet for each identity and owner.
 * @dev Uses CREATE deliberately: wallet addresses are persisted and never inferred, so CREATE2
 *      would add salt/init-code complexity without improving the one-wallet invariants.
 */
contract SentryWalletFactory is Ownable {
    /// @notice Emitted after a wallet is created and indexed.
    /// @param identityHash Identity commitment assigned to the wallet.
    /// @param walletOwner Owner authorized to withdraw and sign.
    /// @param wallet Deployed SentryWallet address.
    event WalletCreated(
        bytes32 indexed identityHash,
        address indexed walletOwner,
        address indexed wallet
    );

    /// @notice Emitted when token addresses for future wallets are updated.
    /// @param usdm New USDm address.
    /// @param usdc New USDC address.
    /// @param usdt New USDT address.
    event SupportedTokensUpdated(address indexed usdm, address indexed usdc, address indexed usdt);

    /// @notice An identity already has a wallet.
    error IdentityAlreadyRegistered();

    /// @notice An owner already has a wallet.
    error OwnerAlreadyRegistered();

    /// @notice Address argument cannot be zero.
    error ZeroAddress();

    /// @notice Identity hash cannot be zero.
    error InvalidIdentity();

    /// @notice EmploymentManager assigned to every deployed wallet.
    address public immutable manager;

    /// @notice USDm address used by wallets created after the latest update.
    address public usdm;

    /// @notice USDC address used by wallets created after the latest update.
    address public usdc;

    /// @notice USDT address used by wallets created after the latest update.
    address public usdt;

    /// @notice Wallet indexed by identity commitment.
    mapping(bytes32 identityHash => address wallet) public walletOfIdentity;

    /// @notice Wallet indexed by owner.
    mapping(address walletOwner => address wallet) public walletOfOwner;

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
        usdm = usdm_;
        usdc = usdc_;
        usdt = usdt_;
    }

    /**
     * @notice Creates and indexes a wallet.
     * @param identityHash Identity commitment for the user.
     * @param walletOwner Owner of the new wallet.
     * @return wallet Address of the deployed wallet.
     */
    function createWallet(
        bytes32 identityHash,
        address walletOwner
    ) external onlyOwner returns (address wallet) {
        if (walletOwner == address(0)) revert ZeroAddress();
        if (identityHash == bytes32(0)) revert InvalidIdentity();
        if (walletOfIdentity[identityHash] != address(0)) revert IdentityAlreadyRegistered();
        if (walletOfOwner[walletOwner] != address(0)) revert OwnerAlreadyRegistered();

        wallet = address(
            new SentryWallet(walletOwner, manager, identityHash, usdm, usdc, usdt)
        );

        walletOfIdentity[identityHash] = wallet;
        walletOfOwner[walletOwner] = wallet;
        identityOfWallet[wallet] = identityHash;

        emit WalletCreated(identityHash, walletOwner, wallet);
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
     * @notice Resolves a wallet from its owner.
     * @param walletOwner Owner to query.
     * @return wallet Registered wallet or zero address.
     */
    function walletFromOwner(address walletOwner) external view returns (address wallet) {
        return walletOfOwner[walletOwner];
    }

    /**
     * @notice Updates token addresses copied into subsequently created wallets.
     * @dev Existing wallets retain their original token configuration.
     * @param usdm_ New USDm address.
     * @param usdc_ New USDC address.
     * @param usdt_ New USDT address.
     */
    function updateSupportedTokens(
        address usdm_,
        address usdc_,
        address usdt_
    ) external onlyOwner {
        _validateAddresses(manager, usdm_, usdc_, usdt_);
        usdm = usdm_;
        usdc = usdc_;
        usdt = usdt_;
        emit SupportedTokensUpdated(usdm_, usdc_, usdt_);
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
