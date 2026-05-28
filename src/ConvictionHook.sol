// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ConvictionMarket} from "./ConvictionMarket.sol";
import {MarketTypes} from "./libraries/MarketTypes.sol";

contract ConvictionHook is IHooks, Ownable {
    using Hooks for IHooks;

    error NotPoolManager();
    error ZeroAddress();
    error MarketNotRegistered();
    error MarketExpired();
    error MarketResolved();
    error MarketPaused();
    error MarketVoided();
    error InvalidHookData();
    error InvalidAction();
    error UnauthorizedRouter();

    enum Action {
        Enter,
        Exit
    }

    bytes4 public constant HOOKDATA_MAGIC = bytes4(keccak256("CONVICTION_HOOKDATA_V1"));

    IPoolManager public immutable poolManager;
    address public authorizedRouter;
    mapping(address market => bool isRegistered) public registeredMarkets;

    event MarketRegistered(address indexed market);
    event MarketUnregistered(address indexed market);
    event AuthorizedRouterSet(address indexed router);
    event HookSwapObserved(bytes32 indexed poolId, address indexed sender);

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(IPoolManager poolManager_, address owner_) Ownable(owner_) {
        if (address(poolManager_) == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        IHooks(address(this)).validateHookPermissions(getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function registerMarket(address market) external onlyOwner {
        if (market == address(0)) revert ZeroAddress();
        registeredMarkets[market] = true;
        emit MarketRegistered(market);
    }

    function unregisterMarket(address market) external onlyOwner {
        if (market == address(0)) revert ZeroAddress();
        registeredMarkets[market] = false;
        emit MarketUnregistered(market);
    }

    function setAuthorizedRouter(address router) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        authorizedRouter = router;
        emit AuthorizedRouterSet(router);
    }

    function beforeInitialize(address, PoolKey calldata, uint160)
        external
        view
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24)
        external
        view
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        view
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external view override onlyPoolManager returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        view
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external view override onlyPoolManager returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeSwap(address sender, PoolKey calldata, SwapParams calldata, bytes calldata hookData)
        external
        view
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (!_isConvictionHookData(hookData)) {
            return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }
        if (sender != authorizedRouter) revert UnauthorizedRouter();

        (Action action, ConvictionMarket market,,,) = _decodeHookData(hookData);
        _validateConvictionAction(action, market);

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(address sender, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata hookData)
        external
        override
        onlyPoolManager
        returns (bytes4, int128)
    {
        if (!_isConvictionHookData(hookData)) {
            emit HookSwapObserved(PoolId.unwrap(key.toId()), sender);
            return (IHooks.afterSwap.selector, 0);
        }
        if (sender != authorizedRouter) revert UnauthorizedRouter();

        (Action action, ConvictionMarket market, address user, MarketTypes.Outcome outcome, uint256 amount) =
            _decodeHookData(hookData);
        _validateConvictionAction(action, market);

        emit HookSwapObserved(PoolId.unwrap(key.toId()), user);

        if (action == Action.Enter) {
            market.enter(user, outcome, amount);
        } else if (action == Action.Exit) {
            market.exit(user, outcome, amount);
        } else {
            revert InvalidAction();
        }

        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        view
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        view
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }

    function _decodeHookData(bytes calldata hookData)
        internal
        pure
        returns (Action action, ConvictionMarket market, address user, MarketTypes.Outcome outcome, uint256 amount)
    {
        if (hookData.length == 0) {
            revert InvalidHookData();
        }
        (
            bytes4 magic,
            Action decodedAction,
            ConvictionMarket decodedMarket,
            address decodedUser,
            MarketTypes.Outcome decodedOutcome,
            uint256 decodedAmount
        ) = abi.decode(hookData, (bytes4, Action, ConvictionMarket, address, MarketTypes.Outcome, uint256));
        if (magic != HOOKDATA_MAGIC) revert InvalidHookData();
        return (decodedAction, decodedMarket, decodedUser, decodedOutcome, decodedAmount);
    }

    function _isConvictionHookData(bytes calldata hookData) internal pure returns (bool) {
        if (hookData.length < 4) return false;
        return bytes4(hookData[:4]) == HOOKDATA_MAGIC;
    }

    function _validateConvictionAction(Action action, ConvictionMarket market) internal view {
        if (action != Action.Enter && action != Action.Exit) revert InvalidAction();
        if (!registeredMarkets[address(market)]) revert MarketNotRegistered();
        if (market.voided()) revert MarketVoided();
        if (market.paused()) revert MarketPaused();
        if (market.resolved()) revert MarketResolved();
        if (block.timestamp >= market.deadline()) revert MarketExpired();
    }
}
