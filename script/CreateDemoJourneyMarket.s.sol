// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {DemoJourneyController} from "../src/DemoJourneyController.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract CreateDemoJourneyMarket is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address controller = _envAddressWithFallback("DEMO_JOURNEY_CONTROLLER", "VITE_DEMO_JOURNEY_CONTROLLER");
        address resolver = _envAddressWithFallback("MANUAL_RESOLVER_ADDRESS", "VITE_CONVICTION_RESOLVER_ADDRESS");
        string memory question =
            vm.envOr("DEMO_JOURNEY_MARKET_QUESTION", string("Will OKB trade above the demo target at settlement?"));
        uint256 duration = vm.envOr("DEMO_JOURNEY_MARKET_DURATION_SECONDS", uint256(7 days));
        uint256 deadline = vm.envOr("DEMO_JOURNEY_MARKET_DEADLINE", block.timestamp + duration);
        uint256 maxCollateral = vm.envOr("DEMO_MAX_COLLATERAL", uint256(1_000 ether));

        require(controller != address(0), "controller is not configured");
        require(resolver != address(0), "resolver is not configured");

        vm.startBroadcast(deployerKey);
        address market =
            DemoJourneyController(controller).createDemoMarketAndRegister(question, resolver, deadline, maxCollateral);
        vm.stopBroadcast();

        ConvictionMarket convictionMarket = ConvictionMarket(market);
        console2.log("DemoJourneyController", controller);
        console2.log("DemoJourneyMarket", market);
        console2.log("MarketId");
        console2.logBytes32(convictionMarket.marketId());
        console2.log("YesToken", address(convictionMarket.yesToken()));
        console2.log("NoToken", address(convictionMarket.noToken()));
        console2.log("CollateralToken", address(convictionMarket.collateralToken()));
        console2.log("Resolver", address(convictionMarket.resolver()));
        console2.log("Hook", convictionMarket.hook());
        console2.log("Deadline", convictionMarket.deadline());
        console2.log("MaxCollateral", convictionMarket.maxCollateral());
        console2.log("InitialOutcome", uint256(MarketTypes.Outcome.Unset));
        console2.log("Set VITE_CONVICTION_MARKET_ADDRESS=", market);
        console2.log("Set DEMO_JOURNEY_MARKET=", market);
        console2.log("Set VITE_DEMO_YES_TOKEN=", address(convictionMarket.yesToken()));
        console2.log("Set VITE_DEMO_NO_TOKEN=", address(convictionMarket.noToken()));
    }

    function _envAddressWithFallback(string memory primary, string memory fallbackKey)
        internal
        view
        returns (address value)
    {
        value = vm.envOr(primary, address(0));
        if (value == address(0)) {
            value = vm.envOr(fallbackKey, address(0));
        }
    }
}
