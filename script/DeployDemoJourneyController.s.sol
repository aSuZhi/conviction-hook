// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {DemoJourneyController} from "../src/DemoJourneyController.sol";
import {DemoPoolBootstrapper} from "./BootstrapDemoPool.s.sol";

contract DeployDemoJourneyController is Script {
    struct DeployConfig {
        address deployer;
        address collateral;
        address manager;
        address bootstrapper;
        address demoMarket;
        address resolver;
        uint256 claimAmount;
        uint256 poolTokenAmount;
        bool transferCollateralOwnership;
        bool transferBootstrapperOwnership;
        bool transferManagerOwnership;
        bool deployDemoPool;
        bool createDemoMarket;
        uint256 poolMintAmount;
        int256 liquidityDelta;
        string question;
        uint256 marketDeadline;
        uint256 maxCollateral;
    }

    struct PoolDeployment {
        address tokenA;
        address tokenB;
        address currency0;
        address currency1;
        bytes32 poolId;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        DeployConfig memory cfg = _readConfig(vm.addr(deployerKey));
        PoolDeployment memory pool;

        vm.startBroadcast(deployerKey);

        DemoJourneyController controller = new DemoJourneyController(
            DemoCollateral(cfg.collateral),
            cfg.manager,
            cfg.deployer,
            cfg.claimAmount,
            cfg.poolTokenAmount,
            cfg.resolver,
            cfg.marketDeadline - block.timestamp,
            cfg.maxCollateral,
            cfg.question
        );

        if (cfg.deployDemoPool) {
            (cfg.bootstrapper, pool) = _deployAndBootstrapPool(cfg.deployer, cfg.poolMintAmount, cfg.liquidityDelta);
        }

        _configureController(controller, cfg);

        if (cfg.createDemoMarket) {
            cfg.demoMarket = controller.createDemoMarketAndRegister(
                cfg.question, cfg.resolver, cfg.marketDeadline, cfg.maxCollateral
            );
        }

        vm.stopBroadcast();

        _logDeployment(address(controller), cfg, pool);
    }

    function _readConfig(address deployer) internal view returns (DeployConfig memory cfg) {
        cfg.deployer = deployer;
        cfg.collateral = _envAddressWithFallback("DEMO_COLLATERAL_TOKEN", "VITE_DEMO_COLLATERAL_TOKEN");
        cfg.manager = _envAddressWithFallback("CONVICTION_MANAGER_ADDRESS", "VITE_CONVICTION_MANAGER_ADDRESS");
        cfg.bootstrapper = vm.envOr("VITE_DEMO_POOL_BOOTSTRAPPER", address(0));
        cfg.demoMarket = vm.envOr("VITE_CONVICTION_MARKET_ADDRESS", address(0));
        cfg.resolver = _envAddressWithFallback("MANUAL_RESOLVER_ADDRESS", "VITE_CONVICTION_RESOLVER_ADDRESS");
        cfg.claimAmount = vm.envOr("DEMO_JOURNEY_CLAIM_AMOUNT", uint256(25 ether));
        cfg.poolTokenAmount = vm.envOr("DEMO_JOURNEY_POOL_TOKEN_AMOUNT", uint256(200));
        cfg.transferCollateralOwnership = vm.envOr("DEMO_JOURNEY_TRANSFER_COLLATERAL_OWNER", false);
        cfg.transferBootstrapperOwnership = vm.envOr("DEMO_JOURNEY_TRANSFER_BOOTSTRAPPER_OWNER", false);
        cfg.transferManagerOwnership = vm.envOr("DEMO_JOURNEY_TRANSFER_MANAGER_OWNER", false);
        cfg.deployDemoPool = vm.envOr("DEMO_JOURNEY_DEPLOY_POOL", false);
        cfg.createDemoMarket = vm.envOr("DEMO_JOURNEY_CREATE_MARKET", false);
        cfg.poolMintAmount = vm.envOr("DEMO_POOL_TOKEN_MINT_AMOUNT", uint256(1_000_000 ether));
        cfg.liquidityDelta = int256(vm.envOr("DEMO_POOL_LIQUIDITY_DELTA", uint256(1e18)));
        cfg.question =
            vm.envOr("DEMO_JOURNEY_MARKET_QUESTION", string("Will OKB trade above the demo target at settlement?"));
        uint256 marketDuration = vm.envOr("DEMO_JOURNEY_MARKET_DURATION_SECONDS", uint256(1 days));
        cfg.marketDeadline = vm.envOr("DEMO_JOURNEY_MARKET_DEADLINE", block.timestamp + marketDuration);
        cfg.maxCollateral = vm.envOr("DEMO_MAX_COLLATERAL", uint256(1_000 ether));
    }

    function _deployAndBootstrapPool(address deployer, uint256 mintAmount, int256 liquidityDelta)
        internal
        returns (address bootstrapperAddress, PoolDeployment memory pool)
    {
        IPoolManager poolManager = IPoolManager(vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"));
        IHooks hook = IHooks(vm.envAddress("VITE_CONVICTION_HOOK_ADDRESS"));
        DemoPoolBootstrapper bootstrapper = new DemoPoolBootstrapper(poolManager, hook, deployer);
        bootstrapper.bootstrap(mintAmount, liquidityDelta);
        bootstrapperAddress = address(bootstrapper);
        pool.tokenA = address(bootstrapper.tokenA());
        pool.tokenB = address(bootstrapper.tokenB());
        (Currency currency0, Currency currency1,,,) = bootstrapper.poolKey();
        pool.currency0 = Currency.unwrap(currency0);
        pool.currency1 = Currency.unwrap(currency1);
        pool.poolId = bootstrapper.poolId();
    }

    function _configureController(DemoJourneyController controller, DeployConfig memory cfg) internal {
        if (cfg.bootstrapper != address(0)) {
            if (cfg.deployDemoPool || cfg.transferBootstrapperOwnership) {
                Ownable(cfg.bootstrapper).transferOwnership(address(controller));
            }
            controller.setBootstrapper(cfg.bootstrapper);
        }

        if (cfg.demoMarket != address(0) && !cfg.createDemoMarket) {
            controller.setDemoMarket(cfg.demoMarket);
        }

        if (cfg.transferCollateralOwnership) {
            Ownable(cfg.collateral).transferOwnership(address(controller));
        }

        if (cfg.transferManagerOwnership) {
            Ownable(cfg.manager).transferOwnership(address(controller));
        }
    }

    function _logDeployment(address controller, DeployConfig memory cfg, PoolDeployment memory pool) internal pure {
        console2.log("DemoJourneyController", controller);
        console2.log("DemoJourneyClaimAmount", cfg.claimAmount);
        console2.log("DemoJourneyPoolTokenAmount", cfg.poolTokenAmount);
        console2.log("DemoJourneyBootstrapper", cfg.bootstrapper);
        console2.log("DemoJourneyMarket", cfg.demoMarket);
        console2.log("Set VITE_DEMO_JOURNEY_CONTROLLER=", controller);
        if (cfg.deployDemoPool) {
            console2.log("DemoPoolTokenA", pool.tokenA);
            console2.log("DemoPoolTokenB", pool.tokenB);
            console2.log("DemoPoolCurrency0", pool.currency0);
            console2.log("DemoPoolCurrency1", pool.currency1);
            console2.log("DemoPoolId");
            console2.logBytes32(pool.poolId);
        }
    }

    function _envAddressWithFallback(string memory primary, string memory fallbackKey)
        internal
        view
        returns (address value)
    {
        value = vm.envOr(primary, address(0));
        if (value == address(0)) {
            value = vm.envAddress(fallbackKey);
        }
    }
}
