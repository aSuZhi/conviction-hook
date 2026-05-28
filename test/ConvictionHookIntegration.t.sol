// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {ManualResolver} from "../src/ManualResolver.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract HookIntegrationCreate2Deployer {
    function deploy(bytes32 salt, bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(deployed != address(0), "create2 failed");
    }
}

contract ConvictionHookIntegrationTest is Test {
    event HookSwapObserved(bytes32 indexed poolId, address indexed sender);
    event ConvictionEntered(
        address indexed user, bytes32 indexed marketId, MarketTypes.Outcome outcome, uint256 amount, uint256 weight
    );
    event ConvictionExited(
        address indexed user,
        bytes32 indexed marketId,
        MarketTypes.Outcome outcome,
        uint256 amount,
        uint256 returnedAmount,
        uint256 tax
    );

    bytes4 private constant HOOKDATA_MAGIC = bytes4(keccak256("CONVICTION_HOOKDATA_V1"));
    uint160 private constant EXPECTED_FLAGS =
        Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;
    address private constant POOL_MANAGER = address(0xCAFE);
    address private constant ROUTER = address(0xA07E2);
    address private constant ALICE = address(0xA11CE);

    HookIntegrationCreate2Deployer private create2Deployer;
    ConvictionHook private hook;
    DemoCollateral private collateral;
    ManualResolver private resolver;
    ConvictionMarket private market;

    function setUp() public {
        create2Deployer = new HookIntegrationCreate2Deployer();
        hook = _deployHookAtValidAddress(IPoolManager(POOL_MANAGER));
        collateral = new DemoCollateral(address(this));
        resolver = new ManualResolver(address(this));
        market = new ConvictionMarket(
            "Will hook callback accounting remain gated?",
            address(collateral),
            address(resolver),
            address(hook),
            block.timestamp + 1 days,
            1_000 ether
        );
        hook.registerMarket(address(market));
        hook.setAuthorizedRouter(ROUTER);
    }

    function testAfterSwapWithEnterHookDataCallsMarketAfterObservation() public {
        uint256 amount = 1 ether;
        collateral.mint(address(market), amount);
        PoolKey memory key = _poolKey();
        bytes32 poolId = PoolId.unwrap(key.toId());
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, amount);

        vm.expectEmit(true, true, false, false, address(hook));
        emit HookSwapObserved(poolId, ALICE);
        vm.expectEmit(true, true, false, false, address(market));
        emit ConvictionEntered(ALICE, market.marketId(), MarketTypes.Outcome.Yes, amount, 0);

        vm.prank(POOL_MANAGER);
        hook.afterSwap(ROUTER, key, _swapParams(), BalanceDeltaLibrary.ZERO_DELTA, hookData);

        assertEq(market.positionOf(ALICE).yesAmount, amount);
        assertEq(market.yesToken().balanceOf(ALICE), amount);
    }

    function testAfterSwapWithExitHookDataCallsMarketAfterObservation() public {
        uint256 amount = 4 ether;
        collateral.mint(address(market), amount);
        PoolKey memory key = _poolKey();
        bytes32 poolId = PoolId.unwrap(key.toId());

        vm.prank(POOL_MANAGER);
        hook.afterSwap(
            ROUTER,
            key,
            _swapParams(),
            BalanceDeltaLibrary.ZERO_DELTA,
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, amount)
        );

        vm.warp(block.timestamp + 12 hours);
        bytes memory exitHookData =
            _hookData(ConvictionHook.Action.Exit, address(market), ALICE, MarketTypes.Outcome.Yes, 1 ether);

        vm.expectEmit(true, true, false, false, address(hook));
        emit HookSwapObserved(poolId, ALICE);
        vm.expectEmit(true, true, false, false, address(market));
        emit ConvictionExited(ALICE, market.marketId(), MarketTypes.Outcome.Yes, 1 ether, 0, 0);

        vm.prank(POOL_MANAGER);
        hook.afterSwap(ROUTER, key, _swapParams(), BalanceDeltaLibrary.ZERO_DELTA, exitHookData);

        assertEq(market.positionOf(ALICE).yesAmount, 3 ether);
        assertEq(market.yesToken().balanceOf(ALICE), 3 ether);
    }

    function testBeforeSwapRejectsExpiredConvictionEntry() public {
        PoolKey memory key = _poolKey();
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, 1 ether);
        vm.warp(market.deadline());

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.MarketExpired.selector);
        hook.beforeSwap(ROUTER, key, _swapParams(), hookData);

        assertEq(market.positionOf(ALICE).yesAmount, 0);
        assertEq(market.yesToken().balanceOf(ALICE), 0);
    }

    function testBeforeSwapRejectsPausedConvictionMarket() public {
        PoolKey memory key = _poolKey();
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, 1 ether);
        market.pause();

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.MarketPaused.selector);
        hook.beforeSwap(ROUTER, key, _swapParams(), hookData);
    }

    function testBeforeSwapRejectsVoidedConvictionMarket() public {
        PoolKey memory key = _poolKey();
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, 1 ether);
        market.voidMarket("ipfs://void");

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.MarketVoided.selector);
        hook.beforeSwap(ROUTER, key, _swapParams(), hookData);
    }

    function testEmptyHookDataStaysNeutralForOrdinarySwaps() public {
        PoolKey memory key = _poolKey();

        vm.prank(POOL_MANAGER);
        hook.beforeSwap(ALICE, key, _swapParams(), bytes(""));

        vm.prank(POOL_MANAGER);
        hook.afterSwap(ALICE, key, _swapParams(), BalanceDeltaLibrary.ZERO_DELTA, bytes(""));
    }

    function testUnregisteredMarketHookDataReverts() public {
        ConvictionMarket unregisteredMarket = new ConvictionMarket(
            "Unregistered market",
            address(collateral),
            address(resolver),
            address(hook),
            block.timestamp + 1 days,
            1_000 ether
        );
        bytes memory hookData = _hookData(
            ConvictionHook.Action.Enter, address(unregisteredMarket), ALICE, MarketTypes.Outcome.Yes, 1 ether
        );

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.MarketNotRegistered.selector);
        hook.beforeSwap(ROUTER, _poolKey(), _swapParams(), hookData);
    }

    function testRecognizedHookDataFromNonRouterRevertsBeforeAccounting() public {
        uint256 amount = 1 ether;
        collateral.mint(address(market), amount);
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, amount);

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.UnauthorizedRouter.selector);
        hook.beforeSwap(ALICE, _poolKey(), _swapParams(), hookData);

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.UnauthorizedRouter.selector);
        hook.afterSwap(ALICE, _poolKey(), _swapParams(), BalanceDeltaLibrary.ZERO_DELTA, hookData);

        assertEq(market.positionOf(ALICE).yesAmount, 0);
        assertEq(market.yesToken().balanceOf(ALICE), 0);
        assertEq(market.collateralPool(), 0);
    }

    function testRecognizedExitHookDataFromNonRouterCannotForceExit() public {
        uint256 amount = 4 ether;
        collateral.mint(address(market), amount);

        vm.prank(POOL_MANAGER);
        hook.afterSwap(
            ROUTER,
            _poolKey(),
            _swapParams(),
            BalanceDeltaLibrary.ZERO_DELTA,
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, amount)
        );

        vm.warp(block.timestamp + 12 hours);
        bytes memory exitHookData =
            _hookData(ConvictionHook.Action.Exit, address(market), ALICE, MarketTypes.Outcome.Yes, 1 ether);

        vm.prank(POOL_MANAGER);
        vm.expectRevert(ConvictionHook.UnauthorizedRouter.selector);
        hook.afterSwap(ALICE, _poolKey(), _swapParams(), BalanceDeltaLibrary.ZERO_DELTA, exitHookData);

        assertEq(market.positionOf(ALICE).yesAmount, amount);
        assertEq(market.yesToken().balanceOf(ALICE), amount);
        assertEq(market.collateralPool(), amount);
    }

    function testUnrelatedNonEmptyHookDataIsNeutral() public {
        bytes memory unrelatedHookData = abi.encode(bytes4(0x12345678), uint256(99), ALICE);

        vm.prank(POOL_MANAGER);
        (bytes4 beforeSelector,,) = hook.beforeSwap(ALICE, _poolKey(), _swapParams(), unrelatedHookData);

        vm.prank(POOL_MANAGER);
        (bytes4 afterSelector, int128 unspecifiedDelta) =
            hook.afterSwap(ALICE, _poolKey(), _swapParams(), BalanceDeltaLibrary.ZERO_DELTA, unrelatedHookData);

        assertEq(beforeSelector, IHooks.beforeSwap.selector);
        assertEq(afterSelector, IHooks.afterSwap.selector);
        assertEq(unspecifiedDelta, 0);
        assertEq(market.positionOf(ALICE).yesAmount, 0);
        assertEq(market.collateralPool(), 0);
    }

    function testMalformedMagicHookDataReverts() public {
        bytes memory malformedHookData = abi.encodePacked(HOOKDATA_MAGIC, bytes1(0x01));

        vm.prank(POOL_MANAGER);
        vm.expectRevert();
        hook.beforeSwap(ROUTER, _poolKey(), _swapParams(), malformedHookData);
    }

    function _deployHookAtValidAddress(IPoolManager poolManager_) internal returns (ConvictionHook deployedHook) {
        bytes memory creationCode =
            abi.encodePacked(type(ConvictionHook).creationCode, abi.encode(poolManager_, address(this)));
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 100_000; ++i) {
            bytes32 salt = bytes32(i);
            address predicted = vm.computeCreate2Address(salt, initCodeHash, address(create2Deployer));

            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == EXPECTED_FLAGS) {
                deployedHook = ConvictionHook(create2Deployer.deploy(salt, creationCode));
                assertEq(address(deployedHook), predicted);
                return deployedHook;
            }
        }

        revert("valid hook address not found");
    }

    function _poolKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _swapParams() internal pure returns (SwapParams memory) {
        return SwapParams({zeroForOne: true, amountSpecified: -100, sqrtPriceLimitX96: 1});
    }

    function _hookData(
        ConvictionHook.Action action,
        address market_,
        address user,
        MarketTypes.Outcome outcome,
        uint256 amount
    ) internal pure returns (bytes memory) {
        return abi.encode(HOOKDATA_MAGIC, action, market_, user, outcome, amount);
    }
}
