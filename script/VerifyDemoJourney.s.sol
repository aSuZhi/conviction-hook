// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

interface IDemoJourneyControllerView {
    function collateral() external view returns (address);
    function manager() external view returns (address);
    function bootstrapper() external view returns (address);
    function demoMarket() external view returns (address);
    function resolver() external view returns (address);
    function claimAmount() external view returns (uint256);
    function poolTokenAmount() external view returns (uint256);
    function sessionDuration() external view returns (uint256);
    function maxCollateral() external view returns (uint256);
    function demoQuestion() external view returns (string memory);
}

interface IOwnableView {
    function owner() external view returns (address);
}

interface IConvictionHookView {
    function authorizedRouter() external view returns (address);
    function registeredMarkets(address market) external view returns (bool);
}

interface IConvictionMarketFactoryView {
    function isMarket(address market) external view returns (bool);
}

interface IConvictionMarketView {
    function collateralToken() external view returns (address);
    function hook() external view returns (address);
    function manager() external view returns (address);
    function resolver() external view returns (address);
    function deadline() external view returns (uint256);
    function resolved() external view returns (bool);
    function yesToken() external view returns (address);
    function noToken() external view returns (address);
}

interface IDemoPoolBootstrapperView {
    function bootstrapped() external view returns (bool);
    function poolId() external view returns (bytes32);
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
}

contract VerifyDemoJourney is Script {
    struct VerifyConfig {
        address controller;
        address collateral;
        address manager;
        address bootstrapper;
        address hook;
        address router;
        address factory;
        address market;
        address resolver;
    }

    function run() external view {
        VerifyConfig memory cfg = _readConfig();
        _requireCode("DemoJourneyController", cfg.controller);

        IDemoJourneyControllerView controller = IDemoJourneyControllerView(cfg.controller);
        address controllerCollateral = controller.collateral();
        address controllerManager = controller.manager();
        address controllerBootstrapper = controller.bootstrapper();
        address controllerMarket = controller.demoMarket();
        address controllerResolver = controller.resolver();

        _requireConfigured("controller collateral", controllerCollateral);
        _requireConfigured("controller manager", controllerManager);
        _requireConfigured("controller bootstrapper", controllerBootstrapper);
        _requireConfigured("controller demo market", controllerMarket);
        _requireConfigured("controller resolver", controllerResolver);

        if (cfg.collateral != address(0)) _requireEqual("controller.collateral", controllerCollateral, cfg.collateral);
        if (cfg.manager != address(0)) _requireEqual("controller.manager", controllerManager, cfg.manager);
        if (cfg.bootstrapper != address(0)) {
            _requireEqual("controller.bootstrapper", controllerBootstrapper, cfg.bootstrapper);
        }
        if (cfg.market != address(0)) _requireEqual("controller.demoMarket", controllerMarket, cfg.market);
        if (cfg.resolver != address(0)) _requireEqual("controller.resolver", controllerResolver, cfg.resolver);

        uint256 claimAmount = controller.claimAmount();
        uint256 poolTokenAmount = controller.poolTokenAmount();
        uint256 sessionDuration = controller.sessionDuration();
        uint256 maxCollateral = controller.maxCollateral();
        string memory demoQuestion = controller.demoQuestion();
        require(claimAmount > 0, "claim amount must be non-zero");
        require(poolTokenAmount > 0, "pool token amount must be non-zero");
        require(sessionDuration > 0, "session duration must be non-zero");
        require(maxCollateral > 0, "max collateral must be non-zero");
        require(bytes(demoQuestion).length > 0, "demo question must be non-empty");

        _requireOwner("DemoCollateral", controllerCollateral, cfg.controller);
        _requireOwner("ConvictionMarketManager", controllerManager, cfg.controller);
        _requireOwner("DemoPoolBootstrapper", controllerBootstrapper, cfg.controller);

        _verifyBootstrapper(controllerBootstrapper);
        _verifyMarket(cfg, controllerManager, controllerCollateral, controllerMarket);

        console2.log("Demo Journey verification passed");
        console2.log("Controller", cfg.controller);
        console2.log("Demo market", controllerMarket);
        console2.log("Claim amount", claimAmount);
        console2.log("Pool token amount", poolTokenAmount);
        console2.log("Session duration", sessionDuration);
        console2.log("Max collateral", maxCollateral);
        console2.log("Demo question", demoQuestion);
    }

    function _verifyBootstrapper(address bootstrapperAddress) internal view {
        _requireCode("DemoPoolBootstrapper", bootstrapperAddress);
        IDemoPoolBootstrapperView bootstrapper = IDemoPoolBootstrapperView(bootstrapperAddress);

        require(bootstrapper.bootstrapped(), "demo pool is not bootstrapped");
        _requireCode("DemoPool token A", bootstrapper.tokenA());
        _requireCode("DemoPool token B", bootstrapper.tokenB());
        console2.log("DemoPool PoolId");
        console2.logBytes32(bootstrapper.poolId());
    }

    function _verifyMarket(
        VerifyConfig memory cfg,
        address expectedManager,
        address expectedCollateral,
        address marketAddress
    ) internal view {
        _requireCode("DemoMarket", marketAddress);
        IConvictionMarketView market = IConvictionMarketView(marketAddress);

        _requireEqual("market.manager", market.manager(), expectedManager);
        _requireEqual("market.collateralToken", market.collateralToken(), expectedCollateral);
        if (cfg.resolver != address(0)) _requireEqual("market.resolver", market.resolver(), cfg.resolver);

        uint256 deadline = market.deadline();
        require(deadline > block.timestamp || market.resolved(), "demo market expired without settlement");

        address yesToken = market.yesToken();
        address noToken = market.noToken();
        _requireCode("DemoMarket YES token", yesToken);
        _requireCode("DemoMarket NO token", noToken);

        if (cfg.hook != address(0)) {
            _requireCode("ConvictionHook", cfg.hook);
            _requireEqual("market.hook", market.hook(), cfg.hook);
            _requireOwner("ConvictionHook", cfg.hook, expectedManager);
            require(IConvictionHookView(cfg.hook).registeredMarkets(marketAddress), "hook did not register demo market");
            if (cfg.router != address(0)) {
                _requireCode("ConvictionRouter", cfg.router);
                _requireEqual("hook.authorizedRouter", IConvictionHookView(cfg.hook).authorizedRouter(), cfg.router);
            }
        }

        if (cfg.factory != address(0)) {
            _requireCode("ConvictionMarketFactory", cfg.factory);
            require(IConvictionMarketFactoryView(cfg.factory).isMarket(marketAddress), "factory does not know demo market");
        }

        console2.log("DemoMarket deadline", deadline);
        console2.log("DemoMarket resolved", market.resolved() ? "true" : "false");
        console2.log("DemoMarket YES token", yesToken);
        console2.log("DemoMarket NO token", noToken);
    }

    function _readConfig() internal view returns (VerifyConfig memory cfg) {
        cfg.controller = _envAddressWithFallback("DEMO_JOURNEY_CONTROLLER", "VITE_DEMO_JOURNEY_CONTROLLER");
        cfg.collateral = _envAddressWithFallback("DEMO_COLLATERAL_TOKEN", "VITE_DEMO_COLLATERAL_TOKEN");
        cfg.manager = _envAddressWithFallback("CONVICTION_MANAGER_ADDRESS", "VITE_CONVICTION_MANAGER_ADDRESS");
        cfg.bootstrapper = _envAddressWithFallback("DEMO_POOL_BOOTSTRAPPER", "VITE_DEMO_POOL_BOOTSTRAPPER");
        cfg.hook = _envAddressWithFallback("CONVICTION_HOOK_ADDRESS", "VITE_CONVICTION_HOOK_ADDRESS");
        cfg.router = _envAddressWithFallback("CONVICTION_ROUTER_ADDRESS", "VITE_CONVICTION_ROUTER_ADDRESS");
        cfg.factory = _envAddressWithFallback("CONVICTION_FACTORY_ADDRESS", "VITE_CONVICTION_FACTORY_ADDRESS");
        cfg.market = _envAddressWithFallback("DEMO_JOURNEY_MARKET", "VITE_CONVICTION_MARKET_ADDRESS");
        cfg.resolver = _envAddressWithFallback("MANUAL_RESOLVER_ADDRESS", "VITE_CONVICTION_RESOLVER_ADDRESS");
    }

    function _envAddressWithFallback(string memory primary, string memory fallbackKey)
        internal
        view
        returns (address value)
    {
        value = vm.envOr(primary, address(0));
        if (value == address(0)) {
            value = vm.envOr(fallbackKey, address(0));
        }
    }

    function _requireOwner(string memory label, address target, address expectedOwner) internal view {
        _requireCode(label, target);
        address owner = IOwnableView(target).owner();
        console2.log(string.concat(label, " owner"), owner);
        require(owner == expectedOwner, string.concat(label, " owner mismatch"));
    }

    function _requireCode(string memory label, address target) internal view {
        _requireConfigured(label, target);
        console2.log(label, target, target.code.length);
        require(target.code.length > 0, string.concat(label, " has no code"));
    }

    function _requireConfigured(string memory label, address target) internal pure {
        require(target != address(0), string.concat(label, " is not configured"));
    }

    function _requireEqual(string memory label, address actual, address expected) internal pure {
        require(actual == expected, string.concat(label, " mismatch"));
    }
}
