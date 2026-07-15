// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title EmploymentContract
 * @notice Prepaid balance vault for Sentry employment.
 *         Billing charge/pause/resume hooks are placeholders for a later prompt.
 */
contract EmploymentContract {
    mapping(address => uint256) private _balances;

    event Deposited(address indexed account, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed account, uint256 amount, uint256 newBalance);

    error InsufficientBalance();
    error ZeroAmount();
    error TransferFailed();
    error NotImplemented();

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        _balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, _balances[msg.sender]);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = _balances[msg.sender];
        if (bal < amount) revert InsufficientBalance();
        _balances[msg.sender] = bal - amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, _balances[msg.sender]);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /// @dev Placeholder — billing deductions come in a later prompt.
    function charge(address /*account*/, uint256 /*amount*/) external pure {
        revert NotImplemented();
    }

    /// @dev Placeholder — employment pause on-chain comes later.
    function pause(address /*account*/) external pure {
        revert NotImplemented();
    }

    /// @dev Placeholder — employment resume on-chain comes later.
    function resume(address /*account*/) external pure {
        revert NotImplemented();
    }
}
