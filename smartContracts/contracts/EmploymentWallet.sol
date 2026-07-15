// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title EmploymentWallet
 * @notice On-chain marker for a user's employment smart wallet address.
 *         Balances are tracked in EmploymentContract keyed by this address.
 */
contract EmploymentWallet {
    bytes32 public immutable identityHash;

    event EmploymentWalletCreated(bytes32 indexed identityHash, address wallet);

    constructor(bytes32 identityHash_) {
        identityHash = identityHash_;
        emit EmploymentWalletCreated(identityHash_, address(this));
    }

    receive() external payable {}
}
