// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "./IERC20.sol";

/**
 * @title EmploymentContract
 * @notice Global payment currency, per-wallet balances, operator billing.
 *         Supports CELO (native), USDm, USDC, USDT. No credit() — users fund via depositNative/depositERC20.
 */
contract EmploymentContract {
    enum PaymentToken {
        CELO,
        USDm,
        USDC,
        USDT
    }

    address public owner;
    address public operator;
    address public treasury;

    PaymentToken public activePaymentToken;
    mapping(PaymentToken => address) public supportedTokens;
    mapping(bytes32 => address) public identityWallet;
    mapping(address => mapping(PaymentToken => uint256)) private _balances;
    mapping(address => bool) private _paused;
    mapping(bytes32 => bool) public chargedActions;

    event Deposited(
        address indexed account,
        PaymentToken indexed token,
        uint256 amount,
        uint256 newBalance
    );
    event Withdrawn(
        address indexed account,
        PaymentToken indexed token,
        uint256 amount,
        uint256 newBalance
    );
    event Charged(
        address indexed account,
        PaymentToken indexed token,
        uint256 amount,
        uint256 newBalance,
        bytes32 indexed actionId
    );
    event Paused(address indexed account);
    event Resumed(address indexed account);
    event Exhausted(address indexed account);
    event IdentityRegistered(bytes32 indexed identityHash, address indexed wallet);
    event ActivePaymentTokenUpdated(PaymentToken indexed token);
    event SupportedTokenUpdated(PaymentToken indexed token, address indexed tokenAddress);
    event TreasuryUpdated(address indexed treasury);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);

    error InsufficientBalance();
    error ZeroAmount();
    error TransferFailed();
    error Unauthorized();
    error AccountPaused();
    error AccountNotPaused();
    error AlreadyCharged();
    error InvalidToken();
    error WrongDepositMethod();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(
        address initialOwner,
        address initialOperator,
        address initialTreasury,
        address usdm,
        address usdc,
        address usdt
    ) {
        require(initialOwner != address(0), "owner=0");
        require(initialOperator != address(0), "operator=0");
        require(initialTreasury != address(0), "treasury=0");
        owner = initialOwner;
        operator = initialOperator;
        treasury = initialTreasury;
        activePaymentToken = PaymentToken.USDm;
        supportedTokens[PaymentToken.USDm] = usdm;
        supportedTokens[PaymentToken.USDC] = usdc;
        supportedTokens[PaymentToken.USDT] = usdt;
        emit OperatorUpdated(address(0), initialOperator);
        emit TreasuryUpdated(initialTreasury);
    }

    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "operator=0");
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "treasury=0");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setActivePaymentToken(PaymentToken token) external onlyOwner {
        if (token != PaymentToken.CELO) {
            if (supportedTokens[token] == address(0)) revert InvalidToken();
        }
        activePaymentToken = token;
        emit ActivePaymentTokenUpdated(token);
    }

    function setSupportedTokenAddress(PaymentToken token, address tokenAddress) external onlyOwner {
        if (token == PaymentToken.CELO) revert InvalidToken();
        require(tokenAddress != address(0), "token=0");
        supportedTokens[token] = tokenAddress;
        emit SupportedTokenUpdated(token, tokenAddress);
    }

    function registerIdentity(bytes32 identityHash, address wallet) external onlyOperator {
        require(wallet != address(0), "wallet=0");
        identityWallet[identityHash] = wallet;
        emit IdentityRegistered(identityHash, wallet);
    }

    function depositNative() external payable {
        if (activePaymentToken != PaymentToken.CELO) revert WrongDepositMethod();
        if (msg.value == 0) revert ZeroAmount();
        if (_paused[msg.sender]) revert AccountPaused();
        _balances[msg.sender][PaymentToken.CELO] += msg.value;
        emit Deposited(msg.sender, PaymentToken.CELO, msg.value, _balances[msg.sender][PaymentToken.CELO]);
    }

    function depositERC20(uint256 amount) external {
        if (activePaymentToken == PaymentToken.CELO) revert WrongDepositMethod();
        if (amount == 0) revert ZeroAmount();
        if (_paused[msg.sender]) revert AccountPaused();
        PaymentToken token = activePaymentToken;
        address tokenAddr = supportedTokens[token];
        if (tokenAddr == address(0)) revert InvalidToken();
        bool ok = IERC20(tokenAddr).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        _balances[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount, _balances[msg.sender][token]);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (_paused[msg.sender]) revert AccountPaused();
        PaymentToken token = activePaymentToken;
        uint256 bal = _balances[msg.sender][token];
        if (bal < amount) revert InsufficientBalance();
        _balances[msg.sender][token] = bal - amount;
        _payout(msg.sender, token, amount);
        emit Withdrawn(msg.sender, token, amount, _balances[msg.sender][token]);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account][activePaymentToken];
    }

    function balanceOfToken(address account, PaymentToken token) external view returns (uint256) {
        return _balances[account][token];
    }

    function isPaused(address account) external view returns (bool) {
        return _paused[account];
    }

    function charge(address account, uint256 amount, bytes32 actionId) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        if (_paused[account]) revert AccountPaused();
        if (chargedActions[actionId]) revert AlreadyCharged();
        PaymentToken token = activePaymentToken;
        uint256 bal = _balances[account][token];
        if (bal < amount) revert InsufficientBalance();
        uint256 next = bal - amount;
        _balances[account][token] = next;
        _payout(treasury, token, amount);
        chargedActions[actionId] = true;
        emit Charged(account, token, amount, next, actionId);
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
        PaymentToken token = activePaymentToken;
        if (_balances[account][token] == 0) revert InsufficientBalance();
        _paused[account] = false;
        emit Resumed(account);
    }

    function _payout(address to, PaymentToken token, uint256 amount) private {
        if (token == PaymentToken.CELO) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            address tokenAddr = supportedTokens[token];
            if (tokenAddr == address(0)) revert InvalidToken();
            bool ok = IERC20(tokenAddr).transfer(to, amount);
            if (!ok) revert TransferFailed();
        }
    }
}
