// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionMarketFactory} from "../src/ConvictionMarketFactory.sol";
import {ConvictionRouter} from "../src/ConvictionRouter.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {ManualResolver} from "../src/ManualResolver.sol";

contract ConvictionCreate2Deployer {
    error Create2Failed();

    function deploy(bytes32 salt, bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        if (deployed == address(0)) revert Create2Failed();
    }
}

contract DeployConviction is Script {
    uint160 private constant EXPECTED_HOOK_FLAGS =
        Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        IPoolManager poolManager = IPoolManager(vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"));

        vm.startBroadcast(deployerKey);

        ConvictionCreate2Deployer create2Deployer = new ConvictionCreate2Deployer();
        ConvictionHook hook = _deployHook(create2Deployer, poolManager, deployer);
        ConvictionRouter router = new ConvictionRouter(poolManager, hook);
        ConvictionMarketFactory factory = new ConvictionMarketFactory(address(hook));
        DemoCollateral collateral = new DemoCollateral(deployer);
        ManualResolver resolver = new ManualResolver(deployer);
        hook.setAuthorizedRouter(address(router));

        vm.stopBroadcast();

        console2.log("ConvictionCreate2Deployer", address(create2Deployer));
        console2.log("ConvictionHook", address(hook));
        console2.log("ConvictionRouter", address(router));
        console2.log("ConvictionMarketFactory", address(factory));
        console2.log("DemoCollateral", address(collateral));
        console2.log("ManualResolver", address(resolver));
    }

    function _deployHook(ConvictionCreate2Deployer create2Deployer, IPoolManager poolManager, address owner)
        internal
        returns (ConvictionHook hook)
    {
        bytes memory creationCode = abi.encodePacked(type(ConvictionHook).creationCode, abi.encode(poolManager, owner));
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 1_000_000; ++i) {
            bytes32 salt = bytes32(i);
            address predicted = vm.computeCreate2Address(salt, initCodeHash, address(create2Deployer));
            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == EXPECTED_HOOK_FLAGS) {
                hook = ConvictionHook(create2Deployer.deploy(salt, creationCode));
                require(address(hook) == predicted, "unexpected hook address");
                return hook;
            }
        }

        revert("valid hook address not found");
    }
}
