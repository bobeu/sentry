// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev Test-only standards-compliant token. Never deploy to production.
 */
contract MockERC20 is ERC20 {
    /// @notice Creates a named mock token.
    /// @param tokenName Token name and symbol.
    constructor(string memory tokenName) ERC20(tokenName, tokenName) {}

    /// @notice Mints tokens for tests.
    /// @param to Recipient.
    /// @param amount Amount to mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
