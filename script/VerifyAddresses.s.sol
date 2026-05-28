// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

contract VerifyAddresses is Script {
    function run() external view {
        _requireCode("PoolManager", vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"));
        _requireCode("PositionManager", vm.envAddress("XLAYER_MAINNET_V4_POSITION_MANAGER"));
        _requireCode("StateView", vm.envAddress("XLAYER_MAINNET_V4_STATE_VIEW"));
        _requireOptionalCode("SwapRouter", vm.envOr("XLAYER_MAINNET_V4_SWAP_ROUTER", address(0)));
        _requireOptionalCode("ConvictionHook", vm.envOr("VITE_CONVICTION_HOOK_ADDRESS", address(0)));
        _requireOptionalCode("ConvictionRouter", vm.envOr("VITE_CONVICTION_ROUTER_ADDRESS", address(0)));
        _requireOptionalCode("ConvictionMarketFactory", vm.envOr("VITE_CONVICTION_FACTORY_ADDRESS", address(0)));
        _requireOptionalCode("ConvictionMarketManager", vm.envOr("VITE_CONVICTION_MANAGER_ADDRESS", address(0)));
        _requireOptionalCode("DemoCollateral", vm.envOr("DEMO_COLLATERAL_TOKEN", address(0)));
        _requireOptionalCode("ManualResolver", vm.envOr("MANUAL_RESOLVER_ADDRESS", address(0)));
        _requireOptionalCode("DemoMarket", vm.envOr("VITE_CONVICTION_MARKET_ADDRESS", address(0)));
    }

    function _requireCode(string memory label, address target) internal view {
        console2.log(label, target, target.code.length);
        require(target.code.length > 0, string.concat(label, " has no code"));
    }

    function _requireOptionalCode(string memory label, address target) internal view {
        if (target == address(0)) {
            console2.log(label, "not configured");
            return;
        }
        _requireCode(label, target);
    }
}
