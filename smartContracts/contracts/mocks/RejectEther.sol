// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Test helper that rejects native transfers.
contract RejectEther {
    receive() external payable {
        revert("no ether");
    }
}
