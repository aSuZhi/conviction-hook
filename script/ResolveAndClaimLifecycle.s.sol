// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {ManualResolver} from "../src/ManualResolver.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract ResolveAndClaimLifecycle is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address claimant = vm.envOr("LIFECYCLE_CLAIMANT", vm.addr(deployerKey));
        ConvictionMarket market = ConvictionMarket(vm.envAddress("LIFECYCLE_MARKET_ADDRESS"));
        ManualResolver resolver = ManualResolver(address(market.resolver()));
        MarketTypes.Outcome winningOutcome =
            MarketTypes.Outcome(vm.envOr("LIFECYCLE_WINNING_OUTCOME", uint256(MarketTypes.Outcome.Yes)));

        require(block.timestamp >= market.deadline(), "market not expired");
        require(!market.resolved(), "market already resolved");
        require(winningOutcome == MarketTypes.Outcome.Yes || winningOutcome == MarketTypes.Outcome.No, "invalid outcome");

        bytes32 marketId = market.marketId();

        vm.startBroadcast(deployerKey);

        try resolver.resolve(marketId) returns (MarketTypes.Outcome existingOutcome) {
            require(existingOutcome == winningOutcome, "resolver outcome mismatch");
        } catch {
            resolver.setOutcome(marketId, winningOutcome);
        }

        market.resolve();
        uint256 claimableBeforeClaim = market.claimable(claimant);
        uint256 claimedAmount = market.claim(claimant);

        vm.stopBroadcast();

        console2.log("LifecycleClaimant", claimant);
        console2.log("LifecycleMarket", address(market));
        console2.log("MarketId");
        console2.logBytes32(marketId);
        console2.log("WinningOutcome", uint256(winningOutcome));
        console2.log("ClaimableBeforeClaim", claimableBeforeClaim);
        console2.log("ClaimedAmount", claimedAmount);
        console2.log("Resolved", market.resolved());
    }
}
