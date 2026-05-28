// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {ConvictionMarketFactory} from "../src/ConvictionMarketFactory.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract CreateDemoMarket is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address factory = vm.envAddress("VITE_CONVICTION_FACTORY_ADDRESS");
        address hook = vm.envAddress("VITE_CONVICTION_HOOK_ADDRESS");
        address collateral = vm.envAddress("DEMO_COLLATERAL_TOKEN");
        address resolver = vm.envAddress("MANUAL_RESOLVER_ADDRESS");
        uint256 duration = vm.envOr("DEMO_MARKET_DURATION_SECONDS", uint256(600));
        uint256 maxCollateral = vm.envOr("DEMO_MAX_COLLATERAL", uint256(1_000 ether));

        require(ConvictionMarketFactory(factory).hook() == hook, "factory hook mismatch");

        vm.startBroadcast(deployerKey);

        address market = ConvictionMarketFactory(factory)
            .createMarket(
                "Will OKB trade above the demo target at deadline?",
                collateral,
                resolver,
                block.timestamp + duration,
                maxCollateral
            );
        ConvictionHook(hook).registerMarket(market);

        vm.stopBroadcast();

        ConvictionMarket convictionMarket = ConvictionMarket(market);
        console2.log("DemoMarket", market);
        console2.log("MarketId");
        console2.logBytes32(convictionMarket.marketId());
        console2.log("YesToken", address(convictionMarket.yesToken()));
        console2.log("NoToken", address(convictionMarket.noToken()));
        console2.log("CollateralToken", address(convictionMarket.collateralToken()));
        console2.log("Resolver", address(convictionMarket.resolver()));
        console2.log("Hook", convictionMarket.hook());
        console2.log("Deadline", convictionMarket.deadline());
        console2.log("InitialOutcome", uint256(MarketTypes.Outcome.Unset));
    }
}
