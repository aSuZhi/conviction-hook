// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {ManualResolver} from "../src/ManualResolver.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";
import {ConvictionMath} from "../src/libraries/ConvictionMath.sol";

contract ConvictionMarketTest is Test {
    bytes4 private constant ZERO_ADDRESS_SELECTOR = bytes4(keccak256("ZeroAddress()"));
    bytes4 private constant TRANSFERS_DISABLED_SELECTOR = bytes4(keccak256("TransfersDisabled()"));

    ConvictionMarket market;
    DemoCollateral collateral;
    ManualResolver resolver;

    address hook = address(0xC0FFEE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 marketId;

    function setUp() public {
        collateral = new DemoCollateral(address(this));
        resolver = new ManualResolver(address(this));
        market = new ConvictionMarket(
            "Will OKB close above target?",
            address(collateral),
            address(resolver),
            hook,
            block.timestamp + 1 days,
            1_000 ether
        );
        marketId = market.marketId();
    }

    function _fundMarket(uint256 amount) internal {
        collateral.mint(address(market), amount);
    }

    function testConstructorRevertsWithZeroCollateralToken() public {
        vm.expectRevert(ZERO_ADDRESS_SELECTOR);
        new ConvictionMarket(
            "Will OKB close above target?", address(0), address(resolver), hook, block.timestamp + 1 days, 1_000 ether
        );
    }

    function testConstructorRevertsWithZeroResolver() public {
        vm.expectRevert(ZERO_ADDRESS_SELECTOR);
        new ConvictionMarket(
            "Will OKB close above target?", address(collateral), address(0), hook, block.timestamp + 1 days, 1_000 ether
        );
    }

    function testConstructorRevertsWithZeroHook() public {
        vm.expectRevert(ZERO_ADDRESS_SELECTOR);
        new ConvictionMarket(
            "Will OKB close above target?",
            address(collateral),
            address(resolver),
            address(0),
            block.timestamp + 1 days,
            1_000 ether
        );
    }

    function testOnlyHookCanCallEnterAndExit() public {
        _fundMarket(2 ether);

        vm.expectRevert(ConvictionMarket.NotHook.selector);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);

        vm.expectRevert(ConvictionMarket.NotHook.selector);
        market.exit(alice, MarketTypes.Outcome.Yes, 0.5 ether);
    }

    function testHookEnterRevertsWhenCollateralBalanceDoesNotCoverNewPool() public {
        _fundMarket(0.5 ether);

        vm.prank(hook);
        vm.expectRevert(ConvictionMarket.InsufficientCollateralBalance.selector);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);

        assertEq(market.collateralPool(), 0);
        assertEq(market.positionOf(alice).yesAmount, 0);
        assertEq(market.yesToken().balanceOf(alice), 0);
    }

    function testHookEnterUpdatesYesNoAmountsWeightsAndProbabilities() public {
        _fundMarket(3 ether);

        vm.prank(hook);
        uint256 yesWeight = market.enter(alice, MarketTypes.Outcome.Yes, 2 ether);

        MarketTypes.Position memory alicePosition = market.positionOf(alice);
        assertEq(alicePosition.yesAmount, 2 ether);
        assertEq(alicePosition.noAmount, 0);
        assertEq(alicePosition.yesWeight, yesWeight);
        assertEq(alicePosition.lastYesEntryTime, block.timestamp);
        assertEq(market.yesExposure(), 2 ether);
        assertEq(market.noExposure(), 0);
        assertEq(market.totalYesWeight(), yesWeight);
        assertEq(market.totalNoWeight(), 0);
        assertEq(market.collateralPool(), 2 ether);
        assertEq(market.yesToken().balanceOf(alice), 2 ether);

        vm.prank(hook);
        uint256 noWeight = market.enter(bob, MarketTypes.Outcome.No, 1 ether);

        MarketTypes.Position memory bobPosition = market.positionOf(bob);
        assertEq(bobPosition.noAmount, 1 ether);
        assertEq(bobPosition.yesAmount, 0);
        assertEq(bobPosition.noWeight, noWeight);
        assertEq(bobPosition.lastNoEntryTime, block.timestamp);
        assertEq(market.yesExposure(), 2 ether);
        assertEq(market.noExposure(), 1 ether);
        assertEq(market.totalNoWeight(), noWeight);
        assertEq(market.collateralPool(), 3 ether);
        assertEq(market.noToken().balanceOf(bob), 1 ether);

        (uint256 yesProb, uint256 noProb) = market.probabilities();
        assertEq(yesProb, 666666666666666666);
        assertEq(noProb, 333333333333333334);
        assertGt(yesWeight, 2 ether);
        assertGt(noWeight, 1 ether);
    }

    function testExitChargesTaxBurnsExposureAndReducesPosition() public {
        _fundMarket(10 ether);

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 10 ether);

        vm.warp(block.timestamp + 12 hours);

        uint256 taxBps = ConvictionMath.exitTaxBps(block.timestamp, market.createdAt(), market.deadline(), 1e18);
        uint256 expectedTax = (4 ether * taxBps) / 10_000;
        uint256 expectedReturned = 4 ether - expectedTax;

        vm.prank(hook);
        (uint256 returnedAmount, uint256 tax) = market.exit(alice, MarketTypes.Outcome.Yes, 4 ether);

        MarketTypes.Position memory position = market.positionOf(alice);
        assertEq(tax, expectedTax);
        assertEq(returnedAmount, expectedReturned);
        assertEq(returnedAmount + tax, 4 ether);
        assertEq(position.yesAmount, 6 ether);
        assertEq(market.yesExposure(), 6 ether);
        assertEq(market.collateralPool(), 10 ether - returnedAmount);
        assertEq(market.yesToken().balanceOf(alice), 6 ether);
        assertLt(position.yesWeight, market.totalYesWeight() + 1);
    }

    function testCannotEnterAfterDeadline() public {
        vm.warp(block.timestamp + 2 days);
        vm.prank(hook);
        vm.expectRevert(ConvictionMarket.MarketExpired.selector);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);
    }

    function testManagerCanPauseAndUnpauseMarket() public {
        market.pause();
        assertTrue(market.paused());

        _fundMarket(1 ether);
        vm.prank(hook);
        vm.expectRevert(ConvictionMarket.MarketPaused.selector);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);

        market.unpause();
        assertFalse(market.paused());

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);
        assertEq(market.positionOf(alice).yesAmount, 1 ether);
    }

    function testNonManagerCannotPauseVoidOrEarlyResolve() public {
        vm.prank(bob);
        vm.expectRevert(ConvictionMarket.NotManager.selector);
        market.pause();

        vm.prank(bob);
        vm.expectRevert(ConvictionMarket.NotManager.selector);
        market.voidMarket("ipfs://void");

        vm.prank(bob);
        vm.expectRevert(ConvictionMarket.NotManager.selector);
        market.earlyResolve(MarketTypes.Outcome.Yes, "ipfs://evidence");
    }

    function testVoidedMarketRefundsOpenExposure() public {
        _fundMarket(3 ether);

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 2 ether);

        market.voidMarket("ipfs://void");
        assertTrue(market.voided());
        assertEq(market.voidEvidenceURI(), "ipfs://void");

        vm.prank(hook);
        vm.expectRevert(ConvictionMarket.MarketVoided.selector);
        market.enter(bob, MarketTypes.Outcome.No, 1 ether);

        vm.prank(alice);
        uint256 refunded = market.refundVoided(alice);

        assertEq(refunded, 2 ether);
        assertEq(collateral.balanceOf(alice), 2 ether);
        assertEq(market.positionOf(alice).yesAmount, 0);
        assertEq(market.yesToken().balanceOf(alice), 0);
        assertEq(market.collateralPool(), 0);
    }

    function testEarlyResolveRecordsEvidenceSnapshotsPoolAndAllowsClaim() public {
        _fundMarket(4 ether);

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 4 ether);

        market.earlyResolve(MarketTypes.Outcome.Yes, "ipfs://resolution");

        assertTrue(market.resolved());
        assertEq(uint8(market.winningOutcome()), uint8(MarketTypes.Outcome.Yes));
        assertEq(market.resolutionEvidenceURI(), "ipfs://resolution");
        assertEq(market.resolvedCollateralPool(), 4 ether);
        assertEq(market.claimable(alice), 4 ether);

        market.claim(alice);
        assertEq(collateral.balanceOf(alice), 4 ether);
    }

    function testOutcomeHolderCannotTransferExposureToAnotherAccount() public {
        _fundMarket(2 ether);

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 1 ether);

        OutcomeToken yesToken = market.yesToken();

        vm.prank(alice);
        vm.expectRevert(TRANSFERS_DISABLED_SELECTOR);
        yesToken.transfer(bob, 0.25 ether);

        assertEq(yesToken.balanceOf(alice), 1 ether);
        assertEq(yesToken.balanceOf(bob), 0);
        assertEq(market.positionOf(alice).yesAmount, 1 ether);
        assertEq(market.positionOf(bob).yesAmount, 0);
    }

    function testResolveAndClaimUsesWinningWeightLosingSideGetsZeroAndDoubleClaimReverts() public {
        _fundMarket(20 ether);

        vm.prank(hook);
        uint256 aliceWeight = market.enter(alice, MarketTypes.Outcome.Yes, 10 ether);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        uint256 bobWeight = market.enter(bob, MarketTypes.Outcome.Yes, 10 ether);

        vm.warp(block.timestamp + 2 days);
        resolver.setOutcome(marketId, MarketTypes.Outcome.Yes);
        market.resolve();

        uint256 totalWinningWeight = aliceWeight + bobWeight;
        uint256 expectedAliceClaim = (market.collateralPool() * aliceWeight) / totalWinningWeight;
        uint256 expectedBobClaim = (market.collateralPool() * bobWeight) / totalWinningWeight;

        assertGt(aliceWeight, bobWeight);
        assertEq(market.claimable(address(0xBAD)), 0);
        assertEq(market.claimable(alice), expectedAliceClaim);
        assertEq(market.claimable(bob), expectedBobClaim);
        assertGt(market.claimable(alice), market.claimable(bob));

        market.claim(alice);
        MarketTypes.Position memory alicePosition = market.positionOf(alice);
        assertTrue(alicePosition.claimed);
        assertEq(collateral.balanceOf(alice), expectedAliceClaim);

        vm.expectRevert(ConvictionMarket.AlreadyClaimed.selector);
        market.claim(alice);
    }

    function testResolveAndClaimLosingSideClaimableIsZero() public {
        _fundMarket(20 ether);

        vm.prank(hook);
        market.enter(alice, MarketTypes.Outcome.Yes, 10 ether);
        vm.prank(hook);
        market.enter(bob, MarketTypes.Outcome.No, 10 ether);

        vm.warp(block.timestamp + 2 days);
        resolver.setOutcome(marketId, MarketTypes.Outcome.Yes);
        market.resolve();

        assertGt(market.claimable(alice), 0);
        assertEq(market.claimable(bob), 0);
        vm.expectRevert(ConvictionMarket.NoClaim.selector);
        market.claim(bob);
    }

    function testResolveSnapshotsCollateralPoolAndAllowsMultipleWinnersToClaim() public {
        address charlie = address(0xCA11);

        _fundMarket(15 ether);

        vm.prank(hook);
        uint256 aliceWeight = market.enter(alice, MarketTypes.Outcome.Yes, 5 ether);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        uint256 bobWeight = market.enter(bob, MarketTypes.Outcome.Yes, 4 ether);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        market.enter(charlie, MarketTypes.Outcome.No, 6 ether);

        vm.warp(block.timestamp + 2 days);
        resolver.setOutcome(marketId, MarketTypes.Outcome.Yes);
        market.resolve();

        uint256 resolvedPool = market.resolvedCollateralPool();
        uint256 totalWinningWeight = aliceWeight + bobWeight;
        uint256 expectedAliceClaim = (resolvedPool * aliceWeight) / totalWinningWeight;
        uint256 expectedBobClaim = (resolvedPool * bobWeight) / totalWinningWeight;

        assertEq(resolvedPool, 15 ether);
        assertGt(expectedAliceClaim, 0);
        assertGt(expectedBobClaim, 0);
        assertEq(market.claimable(alice), expectedAliceClaim);
        assertEq(market.claimable(bob), expectedBobClaim);

        uint256 marketBalanceBeforeClaims = collateral.balanceOf(address(market));

        market.claim(alice);
        market.claim(bob);

        uint256 totalClaimed = collateral.balanceOf(alice) + collateral.balanceOf(bob);
        assertEq(collateral.balanceOf(alice), expectedAliceClaim);
        assertEq(collateral.balanceOf(bob), expectedBobClaim);
        assertLe(totalClaimed, resolvedPool);
        assertGe(marketBalanceBeforeClaims, totalClaimed);
    }
}
