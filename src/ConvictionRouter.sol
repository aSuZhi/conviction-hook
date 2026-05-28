// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";

import {ConvictionHook} from "./ConvictionHook.sol";
import {ConvictionMarket} from "./ConvictionMarket.sol";
import {MarketTypes} from "./libraries/MarketTypes.sol";

contract ConvictionRouter is IUnlockCallback {
    using SafeERC20 for IERC20;
    using SafeCast for int256;

    error NotPoolManager();
    error ZeroAddress();
    error ZeroAmount();
    error HookMismatch();
    error MarketNotRegistered();
    error UnsupportedAction();
    error UnexpectedSwapDelta();

    bytes4 public constant HOOKDATA_MAGIC = bytes4(keccak256("CONVICTION_HOOKDATA_V1"));

    IPoolManager public immutable poolManager;
    ConvictionHook public immutable convictionHook;

    enum Action {
        Enter,
        Exit
    }

    struct SwapRequest {
        Action action;
        address payer;
        PoolKey key;
        SwapParams params;
        address market;
        MarketTypes.Outcome outcome;
        uint256 amount;
    }

    constructor(IPoolManager poolManager_, ConvictionHook convictionHook_) {
        if (address(poolManager_) == address(0) || address(convictionHook_) == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        convictionHook = convictionHook_;
    }

    function enterMarket(
        PoolKey calldata key,
        SwapParams calldata params,
        address market,
        MarketTypes.Outcome outcome,
        uint256 amount
    ) external returns (BalanceDelta swapDelta) {
        _validateRequest(key, market, amount);

        IERC20(ConvictionMarket(market).collateralToken()).safeTransferFrom(msg.sender, market, amount);

        swapDelta = abi.decode(
            poolManager.unlock(
                abi.encode(
                    SwapRequest({
                        action: Action.Enter,
                        payer: msg.sender,
                        key: key,
                        params: params,
                        market: market,
                        outcome: outcome,
                        amount: amount
                    })
                )
            ),
            (BalanceDelta)
        );
    }

    function exitMarket(
        PoolKey calldata key,
        SwapParams calldata params,
        address market,
        MarketTypes.Outcome outcome,
        uint256 amount
    ) external returns (BalanceDelta swapDelta) {
        _validateRequest(key, market, amount);

        swapDelta = abi.decode(
            poolManager.unlock(
                abi.encode(
                    SwapRequest({
                        action: Action.Exit,
                        payer: msg.sender,
                        key: key,
                        params: params,
                        market: market,
                        outcome: outcome,
                        amount: amount
                    })
                )
            ),
            (BalanceDelta)
        );
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        SwapRequest memory request = abi.decode(data, (SwapRequest));
        if (request.action != Action.Enter && request.action != Action.Exit) revert UnsupportedAction();

        BalanceDelta delta = poolManager.swap(
            request.key,
            request.params,
            abi.encode(
                HOOKDATA_MAGIC,
                request.action == Action.Enter ? ConvictionHook.Action.Enter : ConvictionHook.Action.Exit,
                request.market,
                request.payer,
                request.outcome,
                request.amount
            )
        );

        _settleSwapDelta(request.key.currency0, request.payer, delta.amount0());
        _settleSwapDelta(request.key.currency1, request.payer, delta.amount1());

        return abi.encode(delta);
    }

    function _validateRequest(PoolKey calldata key, address market, uint256 amount) internal view {
        if (market == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (address(key.hooks) != address(convictionHook)) revert HookMismatch();
        if (ConvictionMarket(market).hook() != address(convictionHook)) revert HookMismatch();
        if (!convictionHook.registeredMarkets(market)) revert MarketNotRegistered();
    }

    function _settleSwapDelta(Currency currency, address payer, int128 delta) internal {
        if (delta < 0) {
            _settle(currency, payer, _absDelta(delta));
        } else if (delta > 0) {
            poolManager.take(currency, payer, _positiveDelta(delta));
        }
    }

    function _absDelta(int128 delta) internal pure returns (uint256) {
        return SafeCast.toUint128(-delta);
    }

    function _positiveDelta(int128 delta) internal pure returns (uint256) {
        return SafeCast.toUint128(delta);
    }

    function _settle(Currency currency, address payer, uint256 amount) internal {
        if (Currency.unwrap(currency) == address(0)) {
            revert UnexpectedSwapDelta();
        }

        poolManager.sync(currency);
        IERC20(Currency.unwrap(currency)).safeTransferFrom(payer, address(poolManager), amount);
        uint256 paid = poolManager.settle();
        if (paid != amount) revert UnexpectedSwapDelta();
    }
}
