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
import {ConvictionRouter} from "../src/ConvictionRouter.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract ExecuteDemoTrade is Script {
    uint160 private constant MIN_SQRT_PRICE_PLUS_ONE = 4_295_128_740;
    uint160 private constant MAX_SQRT_PRICE_MINUS_ONE = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        ConvictionRouter router = ConvictionRouter(vm.envAddress("VITE_CONVICTION_ROUTER_ADDRESS"));
        address hook = vm.envAddress("VITE_CONVICTION_HOOK_ADDRESS");
        ConvictionMarket market = ConvictionMarket(vm.envAddress("VITE_CONVICTION_MARKET_ADDRESS"));
        DemoCollateral collateral = DemoCollateral(vm.envAddress("DEMO_COLLATERAL_TOKEN"));
        DemoPoolBootstrapper bootstrapper = DemoPoolBootstrapper(vm.envAddress("DEMO_POOL_BOOTSTRAPPER"));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(vm.envAddress("VITE_DEMO_POOL_CURRENCY0")),
            currency1: Currency.wrap(vm.envAddress("VITE_DEMO_POOL_CURRENCY1")),
            fee: uint24(vm.envOr("VITE_DEMO_POOL_FEE", uint256(3000))),
            tickSpacing: int24(int256(vm.envOr("VITE_DEMO_POOL_TICK_SPACING", int256(60)))),
            hooks: IHooks(hook)
        });

        uint256 enterAmount = vm.envOr("DEMO_ENTER_AMOUNT", uint256(2 ether));
        uint256 exitAmount = vm.envOr("DEMO_EXIT_AMOUNT", uint256(1 ether));
        uint256 poolSwapAmount = vm.envOr("DEMO_POOL_SWAP_AMOUNT", uint256(100));
        int256 signedPoolSwapAmount = SafeCast.toInt256(poolSwapAmount);

        require(address(router.poolManager()) == vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"), "router pool manager mismatch");
        require(address(router.convictionHook()) == hook, "router hook mismatch");
        require(market.hook() == hook, "market hook mismatch");
        require(exitAmount <= enterAmount, "exit exceeds enter");
        require(signedPoolSwapAmount > 0, "pool swap amount zero");

        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);

        vm.startBroadcast(deployerKey);

        collateral.mint(deployer, enterAmount);
        bootstrapper.mintDemoPoolTokens(deployer, poolSwapAmount * 2);
        collateral.approve(address(router), enterAmount);
        IERC20(currency0).approve(address(router), poolSwapAmount);
        IERC20(currency1).approve(address(router), poolSwapAmount);

        router.enterMarket(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -signedPoolSwapAmount,
                sqrtPriceLimitX96: MIN_SQRT_PRICE_PLUS_ONE
            }),
            address(market),
            MarketTypes.Outcome.Yes,
            enterAmount
        );

        router.exitMarket(
            key,
            SwapParams({
                zeroForOne: false,
                amountSpecified: -signedPoolSwapAmount,
                sqrtPriceLimitX96: MAX_SQRT_PRICE_MINUS_ONE
            }),
            address(market),
            MarketTypes.Outcome.Yes,
            exitAmount
        );

        vm.stopBroadcast();

        console2.log("DemoTrader", deployer);
        console2.log("DemoMarket", address(market));
        console2.log("PoolId");
        console2.logBytes32(PoolId.unwrap(key.toId()));
        console2.log("EnterAmount", enterAmount);
        console2.log("ExitAmount", exitAmount);
    }
}
