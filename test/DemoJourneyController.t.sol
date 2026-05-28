// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {DemoJourneyController} from "../src/DemoJourneyController.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract MockDemoPoolBootstrapper {
    address public lastTo;
    uint256 public lastAmount;
    uint256 public mintCalls;

    function mintDemoPoolTokens(address to, uint256 amount) external {
        lastTo = to;
        lastAmount = amount;
        mintCalls += 1;
    }
}

contract MockJourneyManager {
    address public lastCreatedMarket = address(0xCAFE);
    address public lastResolvedMarket;
    MarketTypes.Outcome public lastOutcome;
    string public lastEvidenceURI;

    function setLastCreatedMarket(address market) external {
        lastCreatedMarket = market;
    }

    function createMarketAndRegister(string calldata, address, address, uint256, uint256)
        external
        view
        returns (address)
    {
        return lastCreatedMarket;
    }

    function earlyResolveMarket(address market, MarketTypes.Outcome outcome, string calldata evidenceURI) external {
        lastResolvedMarket = market;
        lastOutcome = outcome;
        lastEvidenceURI = evidenceURI;
        MockJourneyMarket(market).setResolved(true);
    }
}

contract MockJourneyMarket {
    bool public resolved;
    bool public voided;
    uint256 public deadline = block.timestamp + 1 days;

    function setResolved(bool value) external {
        resolved = value;
    }

    function setVoided(bool value) external {
        voided = value;
    }

    function setDeadline(uint256 value) external {
        deadline = value;
    }
}

contract DemoJourneyControllerTest is Test {
    address private constant OWNER = address(0xA11CE);
    address private constant USER = address(0xB0B);
    uint256 private constant CLAIM_AMOUNT = 25 ether;
    uint256 private constant POOL_TOKEN_AMOUNT = 200;

    DemoCollateral private collateral;
    MockDemoPoolBootstrapper private bootstrapper;
    MockJourneyManager private manager;
    MockJourneyMarket private market;
    DemoJourneyController private controller;

    function setUp() public {
        collateral = new DemoCollateral(address(this));
        bootstrapper = new MockDemoPoolBootstrapper();
        manager = new MockJourneyManager();
        market = new MockJourneyMarket();

        controller = new DemoJourneyController(
            collateral,
            address(manager),
            OWNER,
            CLAIM_AMOUNT,
            POOL_TOKEN_AMOUNT,
            address(0x1234),
            1 days,
            1_000 ether,
            "Will OKB trade above the demo target at settlement?"
        );
        collateral.transferOwnership(address(controller));
        manager.setLastCreatedMarket(address(market));

        vm.prank(OWNER);
        controller.setBootstrapper(address(bootstrapper));
        vm.prank(OWNER);
        controller.setDemoMarket(address(market));
    }

    function testClaimMintsCollateralAndPoolTokensAndSets24HourCooldown() public {
        vm.prank(USER);
        controller.claimDemoTokens();

        assertEq(collateral.balanceOf(USER), CLAIM_AMOUNT);
        assertEq(bootstrapper.lastTo(), USER);
        assertEq(bootstrapper.lastAmount(), POOL_TOKEN_AMOUNT);
        assertEq(bootstrapper.mintCalls(), 1);
        assertEq(controller.nextClaimAt(USER), block.timestamp + 1 days);
    }

    function testClaimRevertsDuringCooldownAndWorksAfter24Hours() public {
        vm.prank(USER);
        controller.claimDemoTokens();

        vm.prank(USER);
        vm.expectRevert(
            abi.encodeWithSelector(DemoJourneyController.ClaimCoolingDown.selector, block.timestamp + 1 days)
        );
        controller.claimDemoTokens();

        vm.warp(block.timestamp + 1 days);
        vm.prank(USER);
        controller.claimDemoTokens();

        assertEq(collateral.balanceOf(USER), CLAIM_AMOUNT * 2);
        assertEq(bootstrapper.mintCalls(), 2);
    }

    function testOnlyOwnerCanSetDemoMarket() public {
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, USER));
        controller.setDemoMarket(address(0x1234));
    }

    function testOwnerCanCreateAndStoreDemoMarket() public {
        vm.prank(OWNER);
        address created = controller.createDemoMarketAndRegister(
            "Will OKB trade above the demo target?", address(0x1234), block.timestamp + 1 days, 1_000 ether
        );

        assertEq(created, manager.lastCreatedMarket());
        assertEq(controller.demoMarket(), manager.lastCreatedMarket());
    }

    function testUserStartsOwnDemoSession() public {
        vm.prank(USER);
        address created = controller.startDemoSession();

        assertEq(created, manager.lastCreatedMarket());
        assertEq(controller.demoMarketOf(USER), manager.lastCreatedMarket());
        assertEq(controller.demoNonceOf(USER), 1);
        assertEq(controller.demoMarket(), manager.lastCreatedMarket());
    }

    function testSecondUserSessionDoesNotReplaceFirstUserSession() public {
        vm.prank(USER);
        address first = controller.startDemoSession();

        MockJourneyMarket secondMarket = new MockJourneyMarket();
        manager.setLastCreatedMarket(address(secondMarket));

        address secondUser = address(0xCA11);
        vm.prank(secondUser);
        address second = controller.startDemoSession();

        assertEq(controller.demoMarketOf(USER), first);
        assertEq(controller.demoMarketOf(secondUser), second);
        assertEq(controller.demoNonceOf(USER), 1);
        assertEq(controller.demoNonceOf(secondUser), 1);
    }

    function testCannotStartNewSessionWhileCurrentSessionIsActive() public {
        vm.prank(USER);
        address first = controller.startDemoSession();

        MockJourneyMarket secondMarket = new MockJourneyMarket();
        manager.setLastCreatedMarket(address(secondMarket));

        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(DemoJourneyController.DemoSessionStillActive.selector, first));
        controller.startDemoSession();
    }

    function testUserSettlementUsesOwnSessionMarket() public {
        vm.prank(USER);
        address created = controller.startDemoSession();

        vm.prank(USER);
        controller.settleDemoMarket(MarketTypes.Outcome.Yes, "demo://user-triggered-settlement");

        assertEq(manager.lastResolvedMarket(), created);
        assertEq(uint8(manager.lastOutcome()), uint8(MarketTypes.Outcome.Yes));
        assertEq(manager.lastEvidenceURI(), "demo://user-triggered-settlement");
    }

    function testCannotSettleWithoutSessionMarket() public {
        vm.prank(USER);
        vm.expectRevert(DemoJourneyController.DemoMarketNotSet.selector);
        controller.settleDemoMarket(MarketTypes.Outcome.Yes, "demo://missing");
    }

    function testResolvedSessionCanStartNewRound() public {
        vm.prank(USER);
        controller.startDemoSession();

        vm.prank(USER);
        controller.settleDemoMarket(MarketTypes.Outcome.Yes, "demo://round-1");

        MockJourneyMarket nextMarket = new MockJourneyMarket();
        manager.setLastCreatedMarket(address(nextMarket));

        vm.prank(USER);
        address next = controller.startDemoSession();

        assertEq(next, address(nextMarket));
        assertEq(controller.demoMarketOf(USER), address(nextMarket));
        assertEq(controller.demoNonceOf(USER), 2);
    }

    function testExpiredSessionCanStartNewRound() public {
        vm.prank(USER);
        controller.startDemoSession();

        market.setDeadline(block.timestamp - 1);
        MockJourneyMarket nextMarket = new MockJourneyMarket();
        manager.setLastCreatedMarket(address(nextMarket));

        vm.prank(USER);
        address next = controller.startDemoSession();

        assertEq(next, address(nextMarket));
        assertEq(controller.demoNonceOf(USER), 2);
    }

    function testCannotSettleAlreadyResolvedDemoMarket() public {
        vm.prank(USER);
        controller.startDemoSession();
        market.setResolved(true);

        vm.prank(USER);
        vm.expectRevert(DemoJourneyController.DemoMarketAlreadyResolved.selector);
        controller.settleDemoMarket(MarketTypes.Outcome.Yes, "demo://again");
    }
}
