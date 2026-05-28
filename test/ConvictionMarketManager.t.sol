// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {ConvictionMarketFactory} from "../src/ConvictionMarketFactory.sol";
import {ConvictionMarketManager} from "../src/ConvictionMarketManager.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {ManualResolver} from "../src/ManualResolver.sol";

contract ManagerCreate2Deployer {
    function deploy(bytes32 salt, bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(deployed != address(0), "create2 failed");
    }
}

contract ConvictionMarketManagerTest is Test {
    uint160 private constant EXPECTED_FLAGS =
        Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;

    address private constant OWNER = address(0xA11CE);
    address private constant STRANGER = address(0xB0B);
    address private constant POOL_MANAGER = address(0xCAFE);

    ManagerCreate2Deployer private deployer;
    ConvictionHook private hook;
    ConvictionMarketFactory private factory;
    ConvictionMarketManager private manager;
    DemoCollateral private collateral;
    ManualResolver private resolver;

    function setUp() public {
        deployer = new ManagerCreate2Deployer();
        hook = _deployHookAtValidAddress();
        factory = new ConvictionMarketFactory(address(hook));
        manager = new ConvictionMarketManager(factory, hook, OWNER);
        collateral = new DemoCollateral(address(this));
        resolver = new ManualResolver(address(this));

        vm.prank(OWNER);
        hook.transferOwnership(address(manager));
    }

    function testOwnerCanCreateAndRegisterMarketInOneCall() public {
        vm.prank(OWNER);
        address marketAddress = manager.createMarketAndRegister(
            "Will OKB close above target?",
            address(collateral),
            address(resolver),
            block.timestamp + 1 days,
            1_000 ether
        );

        assertTrue(factory.isMarket(marketAddress));
        assertTrue(hook.registeredMarkets(marketAddress));
        assertEq(factory.marketsLength(), 1);
        assertEq(ConvictionMarket(marketAddress).manager(), address(manager));
    }

    function testNonOwnerCannotCreateAndRegisterMarket() public {
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, STRANGER));
        manager.createMarketAndRegister(
            "Will OKB close above target?",
            address(collateral),
            address(resolver),
            block.timestamp + 1 days,
            1_000 ether
        );
    }

    function _deployHookAtValidAddress() internal returns (ConvictionHook deployedHook) {
        bytes memory creationCode =
            abi.encodePacked(type(ConvictionHook).creationCode, abi.encode(IPoolManager(POOL_MANAGER), OWNER));
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 50_000; ++i) {
            bytes32 salt = bytes32(i);
            address predicted = vm.computeCreate2Address(salt, initCodeHash, address(deployer));

            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == EXPECTED_FLAGS) {
                deployedHook = ConvictionHook(deployer.deploy(salt, creationCode));
                assertEq(address(deployedHook), predicted);
                return deployedHook;
            }
        }

        revert("valid hook address not found");
    }
}
