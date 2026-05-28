// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionMarketFactory} from "../src/ConvictionMarketFactory.sol";
import {ConvictionMarketManager} from "../src/ConvictionMarketManager.sol";
import {ConvictionRouter} from "../src/ConvictionRouter.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {DemoJourneyController} from "../src/DemoJourneyController.sol";
import {ManualResolver} from "../src/ManualResolver.sol";
import {DemoPoolBootstrapper} from "./BootstrapDemoPool.s.sol";

contract DemoJourneyCreate2Deployer {
    error Create2Failed();

    function deploy(bytes32 salt, bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        if (deployed == address(0)) revert Create2Failed();
    }
}

contract DeployDemoJourneyStack is Script {
    uint160 private constant EXPECTED_HOOK_FLAGS =
        Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;

    struct StackConfig {
        uint256 deployerKey;
        address deployer;
        IPoolManager poolManager;
        uint256 claimAmount;
        uint256 poolTokenAmount;
        uint256 poolMintAmount;
        int256 liquidityDelta;
        string question;
        uint256 marketDeadline;
        uint256 maxCollateral;
    }

    struct StackAddresses {
        address create2Deployer;
        address hook;
        address router;
        address factory;
        address manager;
        address collateral;
        address resolver;
        address controller;
        address bootstrapper;
        address market;
        address poolTokenA;
        address poolTokenB;
        address poolCurrency0;
        address poolCurrency1;
        bytes32 poolId;
    }

    function run() external {
        StackConfig memory cfg = _readConfig();
        StackAddresses memory deployed;

        vm.startBroadcast(cfg.deployerKey);

        DemoJourneyCreate2Deployer create2Deployer = new DemoJourneyCreate2Deployer();
        deployed.create2Deployer = address(create2Deployer);
        deployed.hook = address(_deployHook(create2Deployer, cfg.poolManager, cfg.deployer));
        deployed.router = address(new ConvictionRouter(cfg.poolManager, ConvictionHook(deployed.hook)));
        deployed.factory = address(new ConvictionMarketFactory(deployed.hook));
        deployed.collateral = address(new DemoCollateral(cfg.deployer));
        deployed.resolver = address(new ManualResolver(cfg.deployer));
        deployed.manager = address(
            new ConvictionMarketManager(
                ConvictionMarketFactory(deployed.factory), ConvictionHook(deployed.hook), cfg.deployer
            )
        );
        deployed.controller = address(
            new DemoJourneyController(
                DemoCollateral(deployed.collateral),
                deployed.manager,
                cfg.deployer,
                cfg.claimAmount,
                cfg.poolTokenAmount,
                deployed.resolver,
                cfg.marketDeadline - block.timestamp,
                cfg.maxCollateral,
                cfg.question
            )
        );
        deployed.bootstrapper = address(new DemoPoolBootstrapper(cfg.poolManager, IHooks(deployed.hook), cfg.deployer));

        ConvictionHook(deployed.hook).setAuthorizedRouter(deployed.router);
        ConvictionHook(deployed.hook).transferOwnership(deployed.manager);

        DemoPoolBootstrapper(deployed.bootstrapper).bootstrap(cfg.poolMintAmount, cfg.liquidityDelta);
        DemoPoolBootstrapper(deployed.bootstrapper).transferOwnership(deployed.controller);
        DemoJourneyController(deployed.controller).setBootstrapper(deployed.bootstrapper);

        DemoCollateral(deployed.collateral).transferOwnership(deployed.controller);
        ConvictionMarketManager(deployed.manager).transferOwnership(deployed.controller);

        deployed.market = DemoJourneyController(deployed.controller).createDemoMarketAndRegister(
            cfg.question, deployed.resolver, cfg.marketDeadline, cfg.maxCollateral
        );

        vm.stopBroadcast();

        DemoPoolBootstrapper bootstrapper = DemoPoolBootstrapper(deployed.bootstrapper);
        deployed.poolTokenA = address(bootstrapper.tokenA());
        deployed.poolTokenB = address(bootstrapper.tokenB());
        (Currency currency0, Currency currency1,,,) = bootstrapper.poolKey();
        deployed.poolCurrency0 = Currency.unwrap(currency0);
        deployed.poolCurrency1 = Currency.unwrap(currency1);
        deployed.poolId = bootstrapper.poolId();

        _logDeployment(deployed, cfg);
    }

    function _readConfig() internal view returns (StackConfig memory cfg) {
        cfg.deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        cfg.deployer = vm.addr(cfg.deployerKey);
        cfg.poolManager = IPoolManager(vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"));
        cfg.claimAmount = vm.envOr("DEMO_JOURNEY_CLAIM_AMOUNT", uint256(25 ether));
        cfg.poolTokenAmount = vm.envOr("DEMO_JOURNEY_POOL_TOKEN_AMOUNT", uint256(200));
        cfg.poolMintAmount = vm.envOr("DEMO_POOL_TOKEN_MINT_AMOUNT", uint256(1_000_000 ether));
        cfg.liquidityDelta = int256(vm.envOr("DEMO_POOL_LIQUIDITY_DELTA", uint256(1e18)));
        cfg.question =
            vm.envOr("DEMO_JOURNEY_MARKET_QUESTION", string("Will OKB trade above the demo target at settlement?"));
        uint256 marketDuration = vm.envOr("DEMO_JOURNEY_MARKET_DURATION_SECONDS", uint256(7 days));
        cfg.marketDeadline = vm.envOr("DEMO_JOURNEY_MARKET_DEADLINE", block.timestamp + marketDuration);
        cfg.maxCollateral = vm.envOr("DEMO_MAX_COLLATERAL", uint256(1_000 ether));
    }

    function _deployHook(DemoJourneyCreate2Deployer create2Deployer, IPoolManager poolManager, address owner)
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

    function _logDeployment(StackAddresses memory deployed, StackConfig memory cfg) internal pure {
        console2.log("ConvictionCreate2Deployer", deployed.create2Deployer);
        console2.log("ConvictionHook", deployed.hook);
        console2.log("ConvictionRouter", deployed.router);
        console2.log("ConvictionMarketFactory", deployed.factory);
        console2.log("ConvictionMarketManager", deployed.manager);
        console2.log("DemoCollateral", deployed.collateral);
        console2.log("ManualResolver", deployed.resolver);
        console2.log("DemoJourneyController", deployed.controller);
        console2.log("DemoPoolBootstrapper", deployed.bootstrapper);
        console2.log("DemoJourneyMarket", deployed.market);
        console2.log("DemoPoolTokenA", deployed.poolTokenA);
        console2.log("DemoPoolTokenB", deployed.poolTokenB);
        console2.log("DemoPoolCurrency0", deployed.poolCurrency0);
        console2.log("DemoPoolCurrency1", deployed.poolCurrency1);
        console2.log("DemoPoolFee", uint256(3000));
        console2.log("DemoPoolTickSpacing", int256(60));
        console2.log("DemoPoolId");
        console2.logBytes32(deployed.poolId);
        console2.log("DemoJourneyClaimAmount", cfg.claimAmount);
        console2.log("DemoJourneyPoolTokenAmount", cfg.poolTokenAmount);
        console2.log("Set VITE_CONVICTION_HOOK_ADDRESS=", deployed.hook);
        console2.log("Set VITE_CONVICTION_ROUTER_ADDRESS=", deployed.router);
        console2.log("Set VITE_CONVICTION_FACTORY_ADDRESS=", deployed.factory);
        console2.log("Set VITE_CONVICTION_MANAGER_ADDRESS=", deployed.manager);
        console2.log("Set VITE_DEMO_COLLATERAL_TOKEN=", deployed.collateral);
        console2.log("Set VITE_CONVICTION_RESOLVER_ADDRESS=", deployed.resolver);
        console2.log("Set VITE_DEMO_JOURNEY_CONTROLLER=", deployed.controller);
        console2.log("Set VITE_DEMO_POOL_BOOTSTRAPPER=", deployed.bootstrapper);
        console2.log("Set VITE_CONVICTION_MARKET_ADDRESS=", deployed.market);
        console2.log("Set VITE_DEMO_POOL_CURRENCY0=", deployed.poolCurrency0);
        console2.log("Set VITE_DEMO_POOL_CURRENCY1=", deployed.poolCurrency1);
    }
}
