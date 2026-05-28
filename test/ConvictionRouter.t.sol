// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {CustomRevert} from "@uniswap/v4-core/src/libraries/CustomRevert.sol";

import {ConvictionHook} from "../src/ConvictionHook.sol";
import {ConvictionRouter} from "../src/ConvictionRouter.sol";
import {ConvictionMarket} from "../src/ConvictionMarket.sol";
import {DemoCollateral} from "../src/DemoCollateral.sol";
import {ManualResolver} from "../src/ManualResolver.sol";
import {ConvictionMath} from "../src/libraries/ConvictionMath.sol";
import {MarketTypes} from "../src/libraries/MarketTypes.sol";

contract RouterCreate2Deployer {
    function deploy(bytes32 salt, bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(deployed != address(0), "create2 failed");
    }
}

contract ConvictionRouterTest is Test {
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
    uint160 private constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    address private constant ALICE = address(0xA11CE);

    RouterCreate2Deployer private create2Deployer;
    PoolManager private manager;
    PoolModifyLiquidityTest private liquidityRouter;
    PoolSwapTest private swapRouter;
    ConvictionHook private hook;
    ConvictionRouter private router;
    DemoCollateral private collateral;
    DemoCollateral private tokenA;
    DemoCollateral private tokenB;
    ManualResolver private resolver;
    ConvictionMarket private market;
    PoolKey private key;
    bytes32 private poolId;

    function setUp() public {
        create2Deployer = new RouterCreate2Deployer();
        manager = new PoolManager(address(this));
        hook = _deployHookAtValidAddress(IPoolManager(address(manager)));
        router = new ConvictionRouter(IPoolManager(address(manager)), hook);
        hook.setAuthorizedRouter(address(router));
        liquidityRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        swapRouter = new PoolSwapTest(IPoolManager(address(manager)));

        tokenA = new DemoCollateral(address(this));
        tokenB = new DemoCollateral(address(this));
        (Currency currency0, Currency currency1) = _sortedCurrencies(address(tokenA), address(tokenB));
        key = PoolKey({
            currency0: currency0, currency1: currency1, fee: 3000, tickSpacing: 60, hooks: IHooks(address(hook))
        });
        poolId = PoolId.unwrap(key.toId());

        manager.initialize(key, SQRT_PRICE_1_1);
        _mintAndApprovePoolTokens(address(this), address(liquidityRouter), 1_000_000 ether);
        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: bytes32(0)}),
            bytes("")
        );

        collateral = new DemoCollateral(address(this));
        resolver = new ManualResolver(address(this));
        market = new ConvictionMarket(
            "Will Task 8 wire the hook path?",
            address(collateral),
            address(resolver),
            address(hook),
            block.timestamp + 1 days,
            1_000 ether
        );
        hook.registerMarket(address(market));

        collateral.mint(ALICE, 100 ether);
        _mintAndApprovePoolTokens(ALICE, address(router), 1_000_000 ether);
        _mintAndApprovePoolTokens(ALICE, address(swapRouter), 1_000_000 ether);
        vm.prank(ALICE);
        collateral.approve(address(router), type(uint256).max);
    }

    function testEnterMarketExecutesRealV4SwapAndHookAccounting() public {
        uint256 amount = 2 ether;
        uint256 expectedWeight = ConvictionMath.combinedWeight(
            amount, block.timestamp, block.timestamp, market.createdAt(), market.deadline(), 5e17
        );

        vm.recordLogs();
        vm.prank(ALICE);
        router.enterMarket(key, _swapParams(true, -100), address(market), MarketTypes.Outcome.Yes, amount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        _assertHookSwapObserved(logs, poolId, ALICE);
        _assertConvictionEntered(logs, ALICE, market.marketId(), MarketTypes.Outcome.Yes, amount, expectedWeight);

        MarketTypes.Position memory position = market.positionOf(ALICE);
        assertEq(position.yesAmount, amount);
        assertEq(position.noAmount, 0);
        assertEq(position.yesWeight, expectedWeight);
        assertEq(market.collateralPool(), amount);
        assertEq(market.yesToken().balanceOf(ALICE), amount);
        assertEq(collateral.balanceOf(address(market)), amount);
    }

    function testExitMarketExecutesRealV4SwapAndHookAccounting() public {
        uint256 enteredAmount = 5 ether;
        vm.prank(ALICE);
        router.enterMarket(key, _swapParams(true, -100), address(market), MarketTypes.Outcome.Yes, enteredAmount);

        vm.warp(block.timestamp + 12 hours);

        uint256 exitAmount = 2 ether;
        uint256 taxBps = ConvictionMath.exitTaxBps(block.timestamp, market.createdAt(), market.deadline(), 1e18);
        uint256 expectedTax = (exitAmount * taxBps) / 10_000;
        uint256 expectedReturned = exitAmount - expectedTax;

        vm.recordLogs();
        vm.prank(ALICE);
        router.exitMarket(key, _swapParams(false, -100), address(market), MarketTypes.Outcome.Yes, exitAmount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        _assertHookSwapObserved(logs, poolId, ALICE);
        _assertConvictionExited(
            logs, ALICE, market.marketId(), MarketTypes.Outcome.Yes, exitAmount, expectedReturned, expectedTax
        );

        MarketTypes.Position memory position = market.positionOf(ALICE);
        assertEq(position.yesAmount, enteredAmount - exitAmount);
        assertEq(market.yesExposure(), enteredAmount - exitAmount);
        assertEq(market.yesToken().balanceOf(ALICE), enteredAmount - exitAmount);
        assertEq(market.collateralPool(), enteredAmount - expectedReturned);
        assertEq(collateral.balanceOf(ALICE), 100 ether - enteredAmount + expectedReturned);
    }

    function testExpiredMarketEntryRevertsThroughSwapPathBeforeMintingExposure() public {
        vm.warp(market.deadline());

        vm.prank(ALICE);
        vm.expectRevert();
        router.enterMarket(key, _swapParams(true, -100), address(market), MarketTypes.Outcome.Yes, 1 ether);

        MarketTypes.Position memory position = market.positionOf(ALICE);
        assertEq(position.yesAmount, 0);
        assertEq(market.yesToken().balanceOf(ALICE), 0);
        assertEq(market.collateralPool(), 0);
        assertEq(collateral.balanceOf(address(market)), 0);
    }

    function testDirectMarketEnterAndExitStillRevertForNonHookCallers() public {
        vm.prank(ALICE);
        vm.expectRevert(ConvictionMarket.NotHook.selector);
        market.enter(ALICE, MarketTypes.Outcome.Yes, 1 ether);

        vm.prank(ALICE);
        router.enterMarket(key, _swapParams(true, -100), address(market), MarketTypes.Outcome.Yes, 1 ether);

        vm.prank(ALICE);
        vm.expectRevert(ConvictionMarket.NotHook.selector);
        market.exit(ALICE, MarketTypes.Outcome.Yes, 0.5 ether);
    }

    function testDirectPoolManagerSwapWithRecognizedHookDataCannotEnter() public {
        uint256 amount = 1 ether;
        collateral.mint(address(market), amount);
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Enter, address(market), ALICE, MarketTypes.Outcome.Yes, amount);

        vm.prank(ALICE);
        vm.expectRevert(_wrappedHookError(IHooks.beforeSwap.selector, ConvictionHook.UnauthorizedRouter.selector));
        swapRouter.swap(key, _swapParams(true, -100), _defaultSwapSettings(), hookData);

        assertEq(market.positionOf(ALICE).yesAmount, 0);
        assertEq(market.yesToken().balanceOf(ALICE), 0);
        assertEq(market.collateralPool(), 0);
    }

    function testDirectPoolManagerSwapWithRecognizedHookDataCannotForceExit() public {
        uint256 enteredAmount = 5 ether;
        vm.prank(ALICE);
        router.enterMarket(key, _swapParams(true, -100), address(market), MarketTypes.Outcome.Yes, enteredAmount);

        vm.warp(block.timestamp + 12 hours);
        bytes memory hookData =
            _hookData(ConvictionHook.Action.Exit, address(market), ALICE, MarketTypes.Outcome.Yes, 1 ether);

        vm.prank(ALICE);
        vm.expectRevert(_wrappedHookError(IHooks.beforeSwap.selector, ConvictionHook.UnauthorizedRouter.selector));
        swapRouter.swap(key, _swapParams(false, -100), _defaultSwapSettings(), hookData);

        assertEq(market.positionOf(ALICE).yesAmount, enteredAmount);
        assertEq(market.yesToken().balanceOf(ALICE), enteredAmount);
        assertEq(market.collateralPool(), enteredAmount);
    }

    function testDirectPoolManagerSwapWithUnrelatedNonEmptyHookDataDoesNotTriggerAccounting() public {
        bytes memory hookData = abi.encode(bytes4(0x12345678), uint256(99), ALICE);

        vm.prank(ALICE);
        swapRouter.swap(key, _swapParams(true, -100), _defaultSwapSettings(), hookData);

        assertEq(market.positionOf(ALICE).yesAmount, 0);
        assertEq(market.yesToken().balanceOf(ALICE), 0);
        assertEq(market.collateralPool(), 0);
    }

    function testEnterMarketRevertsForUnregisteredMarketBeforePrefunding() public {
        ConvictionMarket unregisteredMarket = new ConvictionMarket(
            "Unregistered market",
            address(collateral),
            address(resolver),
            address(hook),
            block.timestamp + 1 days,
            1_000 ether
        );

        vm.prank(ALICE);
        vm.expectRevert(ConvictionRouter.MarketNotRegistered.selector);
        router.enterMarket(key, _swapParams(true, -100), address(unregisteredMarket), MarketTypes.Outcome.Yes, 1 ether);

        assertEq(collateral.balanceOf(address(unregisteredMarket)), 0);
        assertEq(collateral.balanceOf(ALICE), 100 ether);
    }

    function testEnterMarketRevertsForWrongHookKeyBeforePrefunding() public {
        PoolKey memory wrongKey = key;
        wrongKey.hooks = IHooks(address(uint160(EXPECTED_FLAGS)));

        vm.prank(ALICE);
        vm.expectRevert(ConvictionRouter.HookMismatch.selector);
        router.enterMarket(wrongKey, _swapParams(true, -100), address(market), MarketTypes.Outcome.Yes, 1 ether);

        assertEq(collateral.balanceOf(address(market)), 0);
        assertEq(collateral.balanceOf(ALICE), 100 ether);
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

    function _sortedCurrencies(address token0Candidate, address token1Candidate)
        internal
        pure
        returns (Currency currency0, Currency currency1)
    {
        if (token0Candidate < token1Candidate) {
            return (Currency.wrap(token0Candidate), Currency.wrap(token1Candidate));
        }
        return (Currency.wrap(token1Candidate), Currency.wrap(token0Candidate));
    }

    function _mintAndApprovePoolTokens(address account, address spender, uint256 amount) internal {
        tokenA.mint(account, amount);
        tokenB.mint(account, amount);
        vm.startPrank(account);
        tokenA.approve(spender, type(uint256).max);
        tokenB.approve(spender, type(uint256).max);
        vm.stopPrank();
    }

    function _swapParams(bool zeroForOne, int256 amountSpecified) internal pure returns (SwapParams memory) {
        return SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
    }

    function _defaultSwapSettings() internal pure returns (PoolSwapTest.TestSettings memory) {
        return PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
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

    function _wrappedHookError(bytes4 hookSelector, bytes4 reasonSelector) internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            hookSelector,
            abi.encodeWithSelector(reasonSelector),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );
    }

    function _assertHookSwapObserved(Vm.Log[] memory logs, bytes32 expectedPoolId, address expectedUser) internal pure {
        bytes32 signature = keccak256("HookSwapObserved(bytes32,address)");
        bytes32 expectedUserTopic = bytes32(uint256(uint160(expectedUser)));

        for (uint256 i = 0; i < logs.length; ++i) {
            if (
                logs[i].topics.length == 3 && logs[i].topics[0] == signature && logs[i].topics[1] == expectedPoolId
                    && logs[i].topics[2] == expectedUserTopic
            ) {
                return;
            }
        }

        revert("HookSwapObserved not emitted");
    }

    function _assertConvictionEntered(
        Vm.Log[] memory logs,
        address expectedUser,
        bytes32 expectedMarketId,
        MarketTypes.Outcome expectedOutcome,
        uint256 expectedAmount,
        uint256 expectedWeight
    ) internal pure {
        bytes32 signature = keccak256("ConvictionEntered(address,bytes32,uint8,uint256,uint256)");
        bytes32 expectedUserTopic = bytes32(uint256(uint160(expectedUser)));

        for (uint256 i = 0; i < logs.length; ++i) {
            if (
                logs[i].topics.length == 3 && logs[i].topics[0] == signature && logs[i].topics[1] == expectedUserTopic
                    && logs[i].topics[2] == expectedMarketId
            ) {
                (MarketTypes.Outcome outcome, uint256 amount, uint256 weight) =
                    abi.decode(logs[i].data, (MarketTypes.Outcome, uint256, uint256));
                assertEq(uint256(outcome), uint256(expectedOutcome));
                assertEq(amount, expectedAmount);
                assertEq(weight, expectedWeight);
                return;
            }
        }

        revert("ConvictionEntered not emitted");
    }

    function _assertConvictionExited(
        Vm.Log[] memory logs,
        address expectedUser,
        bytes32 expectedMarketId,
        MarketTypes.Outcome expectedOutcome,
        uint256 expectedAmount,
        uint256 expectedReturned,
        uint256 expectedTax
    ) internal pure {
        bytes32 signature = keccak256("ConvictionExited(address,bytes32,uint8,uint256,uint256,uint256)");
        bytes32 expectedUserTopic = bytes32(uint256(uint160(expectedUser)));

        for (uint256 i = 0; i < logs.length; ++i) {
            if (
                logs[i].topics.length == 3 && logs[i].topics[0] == signature && logs[i].topics[1] == expectedUserTopic
                    && logs[i].topics[2] == expectedMarketId
            ) {
                (MarketTypes.Outcome outcome, uint256 amount, uint256 returnedAmount, uint256 tax) =
                    abi.decode(logs[i].data, (MarketTypes.Outcome, uint256, uint256, uint256));
                assertEq(uint256(outcome), uint256(expectedOutcome));
                assertEq(amount, expectedAmount);
                assertEq(returnedAmount, expectedReturned);
                assertEq(tax, expectedTax);
                return;
            }
        }

        revert("ConvictionExited not emitted");
    }
}
