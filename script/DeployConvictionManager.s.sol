// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionMarketFactory} from "../src/ConvictionMarketFactory.sol";
import {ConvictionMarketManager} from "../src/ConvictionMarketManager.sol";

contract DeployConvictionManager is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envOr("CONVICTION_MANAGER_OWNER", vm.addr(deployerKey));
        ConvictionMarketFactory factory = ConvictionMarketFactory(vm.envAddress("CONVICTION_FACTORY_ADDRESS"));
        ConvictionHook hook = ConvictionHook(vm.envAddress("CONVICTION_HOOK_ADDRESS"));

        vm.startBroadcast(deployerKey);

        ConvictionMarketManager manager = new ConvictionMarketManager(factory, hook, owner);
        hook.transferOwnership(address(manager));

        vm.stopBroadcast();

        console2.log("ConvictionMarketManager", address(manager));
        console2.log("ManagerOwner", owner);
        console2.log("HookOwner", hook.owner());
    }
}
