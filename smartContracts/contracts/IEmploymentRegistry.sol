// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IEmploymentRegistry {
    function registerIdentity(bytes32 identityHash, address wallet) external;
}
