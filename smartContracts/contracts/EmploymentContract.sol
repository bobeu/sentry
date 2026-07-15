// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title EmploymentContract
 * @notice Prepaid balance vault for Sentry. Pay-per-completed-work only.
 *         Only the Sentry operator can charge accounts.
 */
contract EmploymentContract {
    address public operator;

    mapping(address => uint256) private _balances;
    mapping(address => bool) private _paused;

    event Deposited(address indexed account, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed account, uint256 amount, uint256 newBalance);
    event Charged(address indexed account, uint256 amount, uint256 newBalance, bytes32 indexed actionId);
    event Paused(address indexed account);
    event Resumed(address indexed account);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event Exhausted(address indexed account);

    error InsufficientBalance();
    error ZeroAmount();
    error TransferFailed();
    error Unauthorized();
    error AccountPaused();
    error AccountNotPaused();

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(address initialOperator) {
        require(initialOperator != address(0), "operator=0");
        operator = initialOperator;
        emit OperatorUpdated(address(0), initialOperator);
    }

    function setOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "operator=0");
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        _balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, _balances[msg.sender]);
    }

    /// @notice Operator-assisted credit (e.g. after off-chain cUSD settlement mirroring).
    function credit(address account, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _balances[account] += amount;
        emit Deposited(account, amount, _balances[account]);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (_paused[msg.sender]) revert AccountPaused();
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

    function isPaused(address account) external view returns (bool) {
        return _paused[account];
    }

    /**
     * @notice Charge a prepaid account for completed work. Only operator.
     * @param actionId Off-chain ActionRecord id hash for idempotency/audit.
     */
    function charge(address account, uint256 amount, bytes32 actionId) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        if (_paused[account]) revert AccountPaused();
        uint256 bal = _balances[account];
        if (bal < amount) revert InsufficientBalance();
        uint256 next = bal - amount;
        _balances[account] = next;
        emit Charged(account, amount, next, actionId);
        if (next == 0) {
            _paused[account] = true;
            emit Exhausted(account);
            emit Paused(account);
        }
    }

    function pause(address account) external onlyOperator {
        if (_paused[account]) revert AccountPaused();
        _paused[account] = true;
        emit Paused(account);
    }

    function resume(address account) external onlyOperator {
        if (!_paused[account]) revert AccountNotPaused();
        if (_balances[account] == 0) revert InsufficientBalance();
        _paused[account] = false;
        emit Resumed(account);
    }
}
