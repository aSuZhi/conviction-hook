// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {DemoPoolBootstrapper} from "./BootstrapDemoPool.s.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {ConvictionMarketManager} from "../src/ConvictionMarketManager.sol";
import {ConvictionRouter} from "../src/ConvictionRouter.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract RunManagedLifecycle is Script {
    uint160 private constant MIN_SQRT_PRICE_PLUS_ONE = 4_295_128_740;
    uint160 private constant MAX_SQRT_PRICE_MINUS_ONE =
        1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341;

    struct Addresses {
        address deployer;
        address manager;
        address router;
        address hook;
        address collateral;
        address resolver;
        address bootstrapper;
        address currency0;
        address currency1;
    }

    struct LifecycleParams {
        string question;
        uint256 duration;
        uint256 maxCollateral;
        uint256 enterAmount;
        uint256 exitAmount;
        uint256 poolSwapAmount;
    }

    struct LifecycleResult {
        address market;
        bytes32 marketId;
        address yesToken;
        address noToken;
        bytes32 poolId;
        uint256 deadline;
        uint256 collateralPool;
        uint256 remainingYesAmount;
        uint256 remainingYesWeight;
        bool resolved;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Addresses memory addrs = _loadAddresses(vm.addr(deployerKey));
        LifecycleParams memory params = _loadParams();
        PoolKey memory key = _loadPoolKey(addrs.hook);
        _validate(addrs, params);

        vm.startBroadcast(deployerKey);

        ConvictionMarket market = _createManagedMarket(addrs, params);
        _executeRouterLifecycle(addrs, params, key, address(market));
        LifecycleResult memory result = _snapshot(addrs.deployer, params, key, market);

        vm.stopBroadcast();

        _logResult(addrs.deployer, params, result);
    }

    function _loadAddresses(address deployer) private view returns (Addresses memory addrs) {
        addrs.deployer = deployer;
        addrs.manager = vm.envAddress("VITE_CONVICTION_MANAGER_ADDRESS");
        addrs.router = vm.envAddress("VITE_CONVICTION_ROUTER_ADDRESS");
        addrs.hook = vm.envAddress("VITE_CONVICTION_HOOK_ADDRESS");
        addrs.collateral = vm.envAddress("DEMO_COLLATERAL_TOKEN");
        addrs.resolver = vm.envAddress("MANUAL_RESOLVER_ADDRESS");
        addrs.bootstrapper = vm.envAddress("DEMO_POOL_BOOTSTRAPPER");
        addrs.currency0 = vm.envAddress("VITE_DEMO_POOL_CURRENCY0");
        addrs.currency1 = vm.envAddress("VITE_DEMO_POOL_CURRENCY1");
    }

    function _loadParams() private view returns (LifecycleParams memory params) {
        params.question = vm.envOr(
            "LIFECYCLE_MARKET_QUESTION",
            string("Conviction final evidence: will the managed lifecycle resolve YES?")
        );
        params.duration = vm.envOr("LIFECYCLE_MARKET_DURATION_SECONDS", uint256(900));
        params.maxCollateral = vm.envOr("DEMO_MAX_COLLATERAL", uint256(1_000 ether));
        params.enterAmount = vm.envOr("DEMO_ENTER_AMOUNT", uint256(2 ether));
        params.exitAmount = vm.envOr("DEMO_EXIT_AMOUNT", uint256(1 ether));
        params.poolSwapAmount = vm.envOr("DEMO_POOL_SWAP_AMOUNT", uint256(100));
    }

    function _loadPoolKey(address hook) private view returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(vm.envAddress("VITE_DEMO_POOL_CURRENCY0")),
            currency1: Currency.wrap(vm.envAddress("VITE_DEMO_POOL_CURRENCY1")),
            fee: uint24(vm.envOr("VITE_DEMO_POOL_FEE", uint256(3000))),
            tickSpacing: int24(int256(vm.envOr("VITE_DEMO_POOL_TICK_SPACING", int256(60)))),
            hooks: IHooks(hook)
        });
    }

    function _validate(Addresses memory addrs, LifecycleParams memory params) private view {
        ConvictionMarketManager manager = ConvictionMarketManager(addrs.manager);
        ConvictionRouter router = ConvictionRouter(addrs.router);

        require(manager.owner() == addrs.deployer, "deployer is not manager owner");
        require(address(manager.hook()) == addrs.hook, "manager hook mismatch");
        require(address(router.poolManager()) == vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"), "router pool manager mismatch");
        require(address(router.convictionHook()) == addrs.hook, "router hook mismatch");
        require(params.exitAmount <= params.enterAmount, "exit exceeds enter");
        require(SafeCast.toInt256(params.poolSwapAmount) > 0, "pool swap amount zero");
    }

    function _createManagedMarket(Addresses memory addrs, LifecycleParams memory params)
        private
        returns (ConvictionMarket market)
    {
        address marketAddress = ConvictionMarketManager(addrs.manager).createMarketAndRegister(
            params.question,
            addrs.collateral,
            addrs.resolver,
            block.timestamp + params.duration,
            params.maxCollateral
        );
        market = ConvictionMarket(marketAddress);
    }

    function _executeRouterLifecycle(
        Addresses memory addrs,
        LifecycleParams memory params,
        PoolKey memory key,
        address market
    ) private {
        int256 signedPoolSwapAmount = SafeCast.toInt256(params.poolSwapAmount);

        DemoCollateral(addrs.collateral).mint(addrs.deployer, params.enterAmount);
        DemoPoolBootstrapper(addrs.bootstrapper).mintDemoPoolTokens(addrs.deployer, params.poolSwapAmount * 2);
        DemoCollateral(addrs.collateral).approve(addrs.router, params.enterAmount);
        IERC20(addrs.currency0).approve(addrs.router, params.poolSwapAmount);
        IERC20(addrs.currency1).approve(addrs.router, params.poolSwapAmount);

        ConvictionRouter(addrs.router).enterMarket(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -signedPoolSwapAmount,
                sqrtPriceLimitX96: MIN_SQRT_PRICE_PLUS_ONE
            }),
            market,
            MarketTypes.Outcome.Yes,
            params.enterAmount
        );

        if (params.exitAmount > 0) {
            ConvictionRouter(addrs.router).exitMarket(
                key,
                SwapParams({
                    zeroForOne: false,
                    amountSpecified: -signedPoolSwapAmount,
                    sqrtPriceLimitX96: MAX_SQRT_PRICE_MINUS_ONE
                }),
                market,
                MarketTypes.Outcome.Yes,
                params.exitAmount
            );
        }
    }

    function _snapshot(address trader, LifecycleParams memory params, PoolKey memory key, ConvictionMarket market)
        private
        view
        returns (LifecycleResult memory result)
    {
        result.market = address(market);
        result.marketId = market.marketId();
        result.yesToken = address(market.yesToken());
        result.noToken = address(market.noToken());
        result.poolId = PoolId.unwrap(key.toId());
        result.deadline = block.timestamp + params.duration;
        result.collateralPool = market.collateralPool();
        MarketTypes.Position memory position = market.positionOf(trader);
        result.remainingYesAmount = position.yesAmount;
        result.remainingYesWeight = position.yesWeight;
        result.resolved = market.resolved();
    }

    function _logResult(address trader, LifecycleParams memory params, LifecycleResult memory result) private pure {
        console2.log("LifecycleTrader", trader);
        console2.log("LifecycleMarket", result.market);
        console2.log("MarketId");
        console2.logBytes32(result.marketId);
        console2.log("YesToken", result.yesToken);
        console2.log("NoToken", result.noToken);
        console2.log("PoolId");
        console2.logBytes32(result.poolId);
        console2.log("Deadline", result.deadline);
        console2.log("EnterAmount", params.enterAmount);
        console2.log("ExitAmount", params.exitAmount);
        console2.log("CollateralPool", result.collateralPool);
        console2.log("RemainingYesAmount", result.remainingYesAmount);
        console2.log("RemainingYesWeight", result.remainingYesWeight);
        console2.log("Resolved", result.resolved);
    }
}
