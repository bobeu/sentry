// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EmploymentWallet} from "./EmploymentWallet.sol";
import {IEmploymentRegistry} from "./IEmploymentRegistry.sol";

/**
 * @title EmploymentWalletFactory
 * @notice Deploys one EmploymentWallet per identityHash. Never regenerates.
 */
contract EmploymentWalletFactory {
    address public operator;
    IEmploymentRegistry public employment;

    mapping(bytes32 => address) public wallets;

    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event WalletCreated(bytes32 indexed identityHash, address wallet);

    error Unauthorized();
    error ZeroAddress();

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(address initialOperator, address employmentContract) {
        if (initialOperator == address(0) || employmentContract == address(0)) {
            revert ZeroAddress();
        }
        operator = initialOperator;
        employment = IEmploymentRegistry(employmentContract);
        emit OperatorUpdated(address(0), initialOperator);
    }

    function setOperator(address newOperator) external onlyOperator {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    /// @notice Create employment wallet for identityHash (idempotent).
    function createWallet(bytes32 identityHash) external onlyOperator returns (address wallet) {
        wallet = wallets[identityHash];
        if (wallet != address(0)) return wallet;

        EmploymentWallet deployed = new EmploymentWallet(identityHash);
        wallet = address(deployed);
        wallets[identityHash] = wallet;
        employment.registerIdentity(identityHash, wallet);
        emit WalletCreated(identityHash, wallet);
    }

    function walletFor(bytes32 identityHash) external view returns (address) {
        return wallets[identityHash];
    }
}
