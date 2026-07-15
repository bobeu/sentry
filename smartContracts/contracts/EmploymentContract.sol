// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EmploymentContract
 * @notice Global payment currency, per-wallet balances, operator billing.
 *         Identity on-chain is bytes32 only — backend computes keccak256(namespace:value).
 */
contract EmploymentContract is Ownable, ReentrancyGuard {
    enum PaymentToken {
        CELO,
        USDm,
        USDC,
        USDT
    }

    address public operator;
    address public treasury;

    PaymentToken public activePaymentToken;
    mapping(PaymentToken => address) public supportedTokens;
    mapping(bytes32 => address) public identityWallet;
    mapping(address => mapping(PaymentToken => uint256)) private _balances;
    mapping(address => bool) private _paused;
    mapping(bytes32 => bool) public chargedActions;
    mapping(bytes32 => bool) public settledBatches;
    mapping(address => bool) public identityRegistrars;

    uint256 private _locked;

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
    event SettlementCompleted(
        address indexed account,
        PaymentToken indexed token,
        uint256 totalAmount,
        bytes32 indexed settlementId
    );
    event Paused(address indexed account);
    event Resumed(address indexed account);
    event EmploymentExhausted(address indexed account);
    event IdentityRegistered(bytes32 indexed identityHash, address indexed wallet);
    event PaymentCurrencyChanged(PaymentToken indexed token);
    event SupportedTokenUpdated(PaymentToken indexed token, address indexed tokenAddress);
    event TreasuryUpdated(address indexed treasury);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event IdentityRegistrarUpdated(address indexed registrar, bool allowed);

    error InsufficientBalance();
    error ZeroAmount();
    error TransferFailed();
    error Unauthorized();
    error AccountPaused();
    error AccountNotPaused();
    error AlreadyCharged();
    error InvalidToken();
    error WrongDepositMethod();
    error ZeroAddress();

    modifier onlyOperator() {
        if (_msgSender() != operator) revert Unauthorized();
        _;
    }

    constructor(
        address initialOwner,
        address initialOperator,
        address initialTreasury,
        address usdm,
        address usdc,
        address usdt
    ) Ownable(initialOwner) {
        if (initialOwner == address(0) || initialOperator == address(0) || initialTreasury == address(0)) {
            revert ZeroAddress();
        }
        operator = initialOperator;
        treasury = initialTreasury;
        activePaymentToken = PaymentToken.CELO;
        supportedTokens[PaymentToken.USDm] = usdm;
        supportedTokens[PaymentToken.USDC] = usdc;
        supportedTokens[PaymentToken.USDT] = usdt;
        emit OperatorUpdated(address(0), initialOperator);
        emit TreasuryUpdated(initialTreasury);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setActivePaymentToken(PaymentToken token) external onlyOwner {
        if (token != PaymentToken.CELO && supportedTokens[token] == address(0)) {
            revert InvalidToken();
        }
        activePaymentToken = token;
        emit PaymentCurrencyChanged(token);
    }

    function setSupportedTokenAddress(PaymentToken token, address tokenAddress) external onlyOwner {
        if (token == PaymentToken.CELO) revert InvalidToken();
        if (tokenAddress == address(0)) revert ZeroAddress();
        supportedTokens[token] = tokenAddress;
        emit SupportedTokenUpdated(token, tokenAddress);
    }

    function setIdentityRegistrar(address registrar, bool allowed) external onlyOwner {
        identityRegistrars[registrar] = allowed;
        emit IdentityRegistrarUpdated(registrar, allowed);
    }

    function registerIdentity(bytes32 identityHash, address wallet) external {
        address sender = _msgSender();
        if (sender != operator && !identityRegistrars[sender]) revert Unauthorized();
        if (wallet == address(0)) revert ZeroAddress();
        identityWallet[identityHash] = wallet;
        emit IdentityRegistered(identityHash, wallet);
    }

    /// @notice Fund caller's own employment balance (Method A — self deposit).
    function depositNative() external payable {
        _depositNative(_msgSender(), msg.value);
    }

    /// @notice Fund another employment wallet from connected wallet (Method A — web deposit).
    function depositNativeFor(address account) external payable {
        _depositNative(account, msg.value);
    }

    function depositERC20(uint256 amount) external {
        _depositERC20(msg.sender, amount);
    }

    function depositERC20For(address account, uint256 amount) external {
        _depositERC20(account, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
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

    function charge(address account, uint256 amount, bytes32 actionId) external onlyOperator nonReentrant {
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
            emit EmploymentExhausted(account);
            emit Paused(account);
        }
    }

    /// @notice Batch settlement — service revenue + settlement fee in one transfer.
    function chargeSettlement(
        address account,
        uint256 totalAmount,
        bytes32 settlementId
    ) external onlyOperator nonReentrant {
        if (totalAmount == 0) revert ZeroAmount();
        if (_paused[account]) revert AccountPaused();
        if (settledBatches[settlementId]) revert AlreadyCharged();
        PaymentToken token = activePaymentToken;
        uint256 bal = _balances[account][token];
        if (bal < totalAmount) revert InsufficientBalance();
        uint256 next = bal - totalAmount;
        _balances[account][token] = next;
        _payout(treasury, token, totalAmount);
        settledBatches[settlementId] = true;
        emit SettlementCompleted(account, token, totalAmount, settlementId);
        if (next == 0) {
            _paused[account] = true;
            emit EmploymentExhausted(account);
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

    function _depositNative(address account, uint256 amount) private {
        if (activePaymentToken != PaymentToken.CELO) revert WrongDepositMethod();
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();
        if (_paused[account]) revert AccountPaused();
        _balances[account][PaymentToken.CELO] += amount;
        emit Deposited(account, PaymentToken.CELO, amount, _balances[account][PaymentToken.CELO]);
    }

    function _depositERC20(address account, uint256 amount) private {
        if (activePaymentToken == PaymentToken.CELO) revert WrongDepositMethod();
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();
        if (_paused[account]) revert AccountPaused();
        PaymentToken token = activePaymentToken;
        address tokenAddr = supportedTokens[token];
        if (tokenAddr == address(0)) revert InvalidToken();
        bool ok = IERC20(tokenAddr).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        _balances[account][token] += amount;
        emit Deposited(account, token, amount, _balances[account][token]);
    }

    function _payout(address to, PaymentToken token, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
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
