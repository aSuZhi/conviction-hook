// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ConvictionMath} from "../src/libraries/ConvictionMath.sol";

contract ConvictionMathTest is Test {
    function testEarlyEntryMultiplierIsHigherForEarlierEntry() public pure {
        uint256 startTime = 100;
        uint256 deadline = 1_000;
        uint256 early = ConvictionMath.earlyEntryMultiplier(200, startTime, deadline);
        uint256 late = ConvictionMath.earlyEntryMultiplier(900, startTime, deadline);
        assertGt(early, late);
        assertGe(late, 1e18);
    }

    function testEarlyEntryMultiplierAtRealisticMarketStartGetsMaxBonus() public pure {
        uint256 startTime = 1_700_000_000;
        uint256 deadline = startTime + 7 days;
        uint256 multiplier = ConvictionMath.earlyEntryMultiplier(startTime, startTime, deadline);
        assertEq(multiplier, 1.5e18);
    }

    function testHoldingMultiplierIncreasesWithHoldingTime() public pure {
        uint256 shortHold = ConvictionMath.holdingTimeMultiplier(100, 200, 1_000);
        uint256 longHold = ConvictionMath.holdingTimeMultiplier(100, 800, 1_000);
        assertGt(longHold, shortHold);
        assertGe(shortHold, 1e18);
    }

    function testContrarianMultiplierHigherWhenSideWasUnpopular() public pure {
        uint256 contrarian = ConvictionMath.contrarianMultiplier(20e16);
        uint256 crowded = ConvictionMath.contrarianMultiplier(80e16);
        assertGt(contrarian, crowded);
        assertGe(crowded, 1e18);
    }

    function testContrarianMultiplierClampsProbabilityAboveWad() public pure {
        uint256 multiplier = ConvictionMath.contrarianMultiplier(2e18);
        assertEq(multiplier, 1e18);
    }

    function testExitTaxIncreasesNearDeadline() public pure {
        uint256 startTime = 100;
        uint256 deadline = 1_000;
        uint256 earlyTax = ConvictionMath.exitTaxBps(200, startTime, deadline, 50e16);
        uint256 lateTax = ConvictionMath.exitTaxBps(900, startTime, deadline, 50e16);
        assertGt(lateTax, earlyTax);
    }

    function testExitTaxAtRealisticMarketStartIsBaseTaxWhenBalanced() public pure {
        uint256 startTime = 1_700_000_000;
        uint256 deadline = startTime + 7 days;
        uint256 taxBps = ConvictionMath.exitTaxBps(startTime, startTime, deadline, 50e16);
        assertEq(taxBps, 50);
    }

    function testExitTaxAtRealisticDeadlineIsBasePlusMaxTimeTaxWhenBalanced() public pure {
        uint256 startTime = 1_700_000_000;
        uint256 deadline = startTime + 7 days;
        uint256 taxBps = ConvictionMath.exitTaxBps(deadline, startTime, deadline, 50e16);
        assertEq(taxBps, 300);
    }

    function testExitTaxAtRealisticMidpointIsBetweenStartAndDeadline() public pure {
        uint256 startTime = 1_700_000_000;
        uint256 deadline = startTime + 7 days;
        uint256 midpoint = startTime + ((deadline - startTime) / 2);
        uint256 startTaxBps = ConvictionMath.exitTaxBps(startTime, startTime, deadline, 50e16);
        uint256 midpointTaxBps = ConvictionMath.exitTaxBps(midpoint, startTime, deadline, 50e16);
        uint256 deadlineTaxBps = ConvictionMath.exitTaxBps(deadline, startTime, deadline, 50e16);
        assertGt(midpointTaxBps, startTaxBps);
        assertLt(midpointTaxBps, deadlineTaxBps);
    }

    function testExitTaxIncreasesWithCrowding() public pure {
        uint256 startTime = 100;
        uint256 deadline = 1_000;
        uint256 balanced = ConvictionMath.exitTaxBps(500, startTime, deadline, 50e16);
        uint256 crowded = ConvictionMath.exitTaxBps(500, startTime, deadline, 90e16);
        assertGt(crowded, balanced);
    }

    function testExitTaxAtMidpointWithFullProbabilityGetsMaxImbalanceTax() public pure {
        uint256 startTime = 1_700_000_000;
        uint256 duration = 7 days;
        uint256 deadline = startTime + duration;
        uint256 midpoint = startTime + (duration / 2);

        uint256 taxBps = ConvictionMath.exitTaxBps(midpoint, startTime, deadline, 1e18);
        assertEq(taxBps, 50 + 125 + 200);
    }

    function testExitTaxClampsProbabilityAboveWad() public pure {
        uint256 startTime = 1_700_000_000;
        uint256 deadline = startTime + 7 days;
        uint256 clampedTaxBps =
            ConvictionMath.exitTaxBps(startTime + ((deadline - startTime) / 2), startTime, deadline, 1e18);
        uint256 oversizedTaxBps =
            ConvictionMath.exitTaxBps(startTime + ((deadline - startTime) / 2), startTime, deadline, 2e18);

        assertEq(oversizedTaxBps, clampedTaxBps);
    }

    function testProbabilitySplit() public pure {
        (uint256 yesProb, uint256 noProb) = ConvictionMath.probabilitySplit(3 ether, 1 ether);
        assertEq(yesProb, 75e16);
        assertEq(noProb, 25e16);
    }
}
