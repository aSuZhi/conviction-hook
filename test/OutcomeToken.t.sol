// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";

contract OutcomeTokenTest is Test {
    bytes4 private constant TRANSFERS_DISABLED_SELECTOR = bytes4(keccak256("TransfersDisabled()"));

    address minter = address(0xA11CE);
    address user = address(0xB0B);
    address recipient = address(0xCA11);

    function testOutcomeTokenDeploymentRevertsWithZeroMinter() public {
        vm.expectRevert(OutcomeToken.ZeroMinter.selector);
        new OutcomeToken("Conviction YES", "cvYES", address(0));
    }

    function testOnlyMinterCanMintAndBurnOutcomeTokens() public {
        OutcomeToken token = new OutcomeToken("Conviction YES", "cvYES", minter);

        vm.expectRevert(OutcomeToken.NotMinter.selector);
        token.mint(user, 1 ether);

        vm.prank(minter);
        token.mint(user, 1 ether);
        assertEq(token.balanceOf(user), 1 ether);

        vm.expectRevert(OutcomeToken.NotMinter.selector);
        token.burn(user, 0.5 ether);

        vm.prank(minter);
        token.burn(user, 0.5 ether);
        assertEq(token.balanceOf(user), 0.5 ether);
    }

    function testDirectTransfersAreDisabledWhileMintAndBurnStillWork() public {
        OutcomeToken token = new OutcomeToken("Conviction YES", "cvYES", minter);

        vm.prank(minter);
        token.mint(user, 1 ether);

        vm.prank(user);
        vm.expectRevert(TRANSFERS_DISABLED_SELECTOR);
        token.transfer(recipient, 0.25 ether);

        vm.prank(minter);
        token.burn(user, 0.4 ether);

        assertEq(token.balanceOf(user), 0.6 ether);
        assertEq(token.balanceOf(recipient), 0);
        assertEq(token.totalSupply(), 0.6 ether);
    }

    function testDemoCollateralOwnerCanMint() public {
        DemoCollateral token = new DemoCollateral(address(this));
        token.mint(user, 100 ether);
        assertEq(token.balanceOf(user), 100 ether);
        assertEq(token.decimals(), 18);
    }
}
