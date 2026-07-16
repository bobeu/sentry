// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentryWallet
 * @notice Custodies one user's CELO and supported ERC20 funds.
 * @dev Employment state and accounting deliberately remain in EmploymentManager.
 */
contract SentryWallet is Ownable, ReentrancyGuard, IERC1271 {
    using SafeERC20 for IERC20;

    /// @notice EIP-1271 success return value.
    bytes4 public constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    /// @notice EIP-1271 failure return value.
    bytes4 public constant EIP1271_INVALID_SIGNATURE = 0xffffffff;

    /// @notice Assets supported by the wallet.
    enum Token {
        CELO,
        USDm,
        USDC,
        USDT
    }

    /// @notice Private identity commitment associated with this wallet.
    bytes32 public immutable identityHash;

    /// @notice Manager authorized to execute settlements.
    address public immutable manager;

    /// @notice ERC20 contract for each non-native token.
    mapping(Token token => address tokenContract) public tokenAddress;

    /// @notice Emitted when native CELO is received.
    /// @param from Sender of the funds.
    /// @param amount Amount received.
    event NativeReceived(address indexed from, uint256 amount);

    /// @notice Emitted after the owner withdraws funds.
    /// @param to Recipient of the withdrawal.
    /// @param token Asset withdrawn.
    /// @param amount Amount withdrawn.
    event Withdrawal(address indexed to, Token indexed token, uint256 amount);

    /// @notice Emitted after the manager executes a settlement.
    /// @param treasury Settlement recipient.
    /// @param token Settled asset.
    /// @param amount Total settlement amount.
    /// @param settlementId Unique settlement identifier.
    event SettlementExecuted(
        address indexed treasury,
        Token indexed token,
        uint256 amount,
        bytes32 indexed settlementId
    );

    /// @notice Caller is not the employment manager.
    error UnauthorizedManager();

    /// @notice Address argument cannot be zero.
    error ZeroAddress();

    /// @notice Identity hash cannot be zero.
    error InvalidIdentity();

    /// @notice CELO was supplied where an ERC20 token is required.
    error InvalidToken();

    /// @notice Amount must be greater than zero.
    error InvalidAmount();

    /// @notice Native CELO transfer failed.
    error NativeTransferFailed();

    /// @dev Restricts settlement execution to EmploymentManager.
    modifier onlyManager() {
        if (msg.sender != manager) revert UnauthorizedManager();
        _;
    }

    /**
     * @notice Creates a wallet for one owner and identity.
     * @param initialOwner Owner who may withdraw and whose signatures are validated.
     * @param employmentManager Manager authorized to settle funds.
     * @param identityHash_ Namespaced identity commitment.
     * @param usdm USDm token address.
     * @param usdc USDC token address.
     * @param usdt USDT token address.
     */
    constructor(
        address initialOwner,
        address employmentManager,
        bytes32 identityHash_,
        address usdm,
        address usdc,
        address usdt
    ) Ownable(initialOwner) {
        if (
            employmentManager == address(0) ||
            usdm == address(0) ||
            usdc == address(0) ||
            usdt == address(0)
        ) revert ZeroAddress();
        if (identityHash_ == bytes32(0)) revert InvalidIdentity();

        manager = employmentManager;
        identityHash = identityHash_;
        tokenAddress[Token.USDm] = usdm;
        tokenAddress[Token.USDC] = usdc;
        tokenAddress[Token.USDT] = usdt;
    }

    /// @notice Accepts native CELO transfers.
    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }

    /// @notice Returns the wallet's native CELO balance.
    /// @return balance Current CELO balance.
    function nativeBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }

    /**
     * @notice Returns the wallet balance for a supported ERC20.
     * @param token Token to query.
     * @return balance Current token balance.
     */
    function erc20Balance(Token token) external view returns (uint256 balance) {
        address tokenContract = _erc20Address(token);
        return IERC20(tokenContract).balanceOf(address(this));
    }

    /**
     * @notice Withdraws native CELO to the wallet owner.
     * @param amount Amount to withdraw.
     */
    function withdrawNative(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        address recipient = owner();
        (bool ok, ) = payable(recipient).call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
        emit Withdrawal(recipient, Token.CELO, amount);
    }

    /**
     * @notice Withdraws a supported ERC20 to the wallet owner.
     * @param token Token to withdraw.
     * @param amount Amount to withdraw.
     */
    function withdrawERC20(Token token, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        address tokenContract = _erc20Address(token);
        address recipient = owner();
        IERC20(tokenContract).safeTransfer(recipient, amount);
        emit Withdrawal(recipient, token, amount);
    }

    /**
     * @notice Transfers an authorized batch settlement to the treasury.
     * @dev Replay protection and employment validation are enforced by EmploymentManager.
     * @param token Asset to settle.
     * @param treasury Settlement recipient.
     * @param amount Service amount plus settlement fee.
     * @param settlementId Unique settlement identifier.
     */
    function executeSettlement(
        Token token,
        address treasury,
        uint256 amount,
        bytes32 settlementId
    ) external onlyManager nonReentrant {
        if (treasury == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        if (token == Token.CELO) {
            (bool ok, ) = payable(treasury).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(_erc20Address(token)).safeTransfer(treasury, amount);
        }

        emit SettlementExecuted(treasury, token, amount, settlementId);
    }

    /**
     * @notice Validates an EIP-1271 signature against the current wallet owner.
     * @param hash Signed digest.
     * @param signature Encoded ECDSA signature.
     * @return result EIP-1271 magic value on success, invalid value otherwise.
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view override returns (bytes4 result) {
        (address signer, ECDSA.RecoverError error, ) = ECDSA.tryRecover(hash, signature);
        if (error == ECDSA.RecoverError.NoError && signer == owner()) {
            return EIP1271_MAGIC_VALUE;
        }
        return EIP1271_INVALID_SIGNATURE;
    }

    /**
     * @dev Resolves a non-native token and rejects unsupported selections.
     * @param token Token to resolve.
     * @return tokenContract ERC20 contract address.
     */
    function _erc20Address(Token token) private view returns (address tokenContract) {
        if (token == Token.CELO) revert InvalidToken();
        tokenContract = tokenAddress[token];
        if (tokenContract == address(0)) revert InvalidToken();
    }
}
