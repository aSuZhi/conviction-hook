// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ConvictionMarketFactory} from "../src/ConvictionMarketFactory.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {ManualResolver} from "../src/ManualResolver.sol";

contract ConvictionMarketFactoryTest is Test {
    bytes4 private constant ZERO_ADDRESS_SELECTOR = bytes4(keccak256("ZeroAddress()"));

    function testConstructorRevertsWithZeroHook() public {
        vm.expectRevert(ZERO_ADDRESS_SELECTOR);
        new ConvictionMarketFactory(address(0));
    }

    function testCreateMarketRegistersMarket() public {
        DemoCollateral collateral = new DemoCollateral(address(this));
        ManualResolver resolver = new ManualResolver(address(this));
        ConvictionMarketFactory factory = new ConvictionMarketFactory(address(0xC0FFEE));

        address marketAddress = factory.createMarket(
            "Will OKB close above target?",
            address(collateral),
            address(resolver),
            block.timestamp + 1 days,
            1_000 ether
        );

        assertTrue(factory.isMarket(marketAddress));
        assertEq(factory.marketsLength(), 1);
        assertEq(factory.hook(), address(0xC0FFEE));

        ConvictionMarket market = ConvictionMarket(marketAddress);
        assertEq(address(market.collateralToken()), address(collateral));
        assertEq(address(market.resolver()), address(resolver));
        assertEq(market.hook(), address(0xC0FFEE));
        assertEq(market.question(), "Will OKB close above target?");
    }
}
