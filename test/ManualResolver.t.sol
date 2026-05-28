// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ManualResolver} from "../src/ManualResolver.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract ManualResolverTest is Test {
    function testOnlyOwnerCanSetOutcome() public {
        ManualResolver resolver = new ManualResolver(address(this));
        bytes32 marketId = keccak256("market");

        vm.prank(address(0xB0B));
        vm.expectRevert();
        resolver.setOutcome(marketId, MarketTypes.Outcome.Yes);

        resolver.setOutcome(marketId, MarketTypes.Outcome.Yes);
        assertEq(uint8(resolver.resolve(marketId)), uint8(MarketTypes.Outcome.Yes));
    }

    function testResolveRevertsWhenUnset() public {
        ManualResolver resolver = new ManualResolver(address(this));
        vm.expectRevert(ManualResolver.OutcomeUnset.selector);
        resolver.resolve(keccak256("missing"));
    }

    function testSettingOutcomeTwiceRevertsAndKeepsFirstOutcome() public {
        ManualResolver resolver = new ManualResolver(address(this));
        bytes32 marketId = keccak256("market");

        resolver.setOutcome(marketId, MarketTypes.Outcome.Yes);

        vm.expectRevert(ManualResolver.OutcomeAlreadySet.selector);
        resolver.setOutcome(marketId, MarketTypes.Outcome.No);

        assertEq(uint8(resolver.resolve(marketId)), uint8(MarketTypes.Outcome.Yes));
    }
}
