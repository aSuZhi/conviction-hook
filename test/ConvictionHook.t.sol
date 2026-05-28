// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";

contract Create2Deployer {
    function deploy(bytes32 salt, bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(deployed != address(0), "create2 failed");
    }
}

contract ConvictionHookTest is Test {
    event HookSwapObserved(bytes32 indexed poolId, address indexed sender);

    bytes4 private constant OWNABLE_UNAUTHORIZED_ACCOUNT_SELECTOR =
        bytes4(keccak256("OwnableUnauthorizedAccount(address)"));
    uint160 private constant EXPECTED_FLAGS =
        Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;

    address private constant OWNER = address(0xA11CE);
    address private constant STRANGER = address(0xB0B);
    address private constant POOL_MANAGER = address(0xCAFE);
    address private constant SWAPPER = address(0xD00D);

    Create2Deployer private deployer;
    ConvictionHook private hook;

    function setUp() public {
        deployer = new Create2Deployer();
        hook = _deployHookAtValidAddress();
    }

    function testStoresPoolManagerAndOwner() public view {
        assertEq(address(hook.poolManager()), POOL_MANAGER);
        assertEq(hook.owner(), OWNER);
    }

    function testOwnerCanRegisterAndUnregisterMarket() public {
        address market = address(0xC0FFEE);

        vm.prank(OWNER);
        hook.registerMarket(market);
        assertTrue(hook.registeredMarkets(market));

        vm.prank(OWNER);
        hook.unregisterMarket(market);
        assertFalse(hook.registeredMarkets(market));
    }

    function testOwnerCanSetAuthorizedRouter() public {
        address router = address(0xA07E2);

        vm.prank(OWNER);
        hook.setAuthorizedRouter(router);

        assertEq(hook.authorizedRouter(), router);
    }

    function testSetAuthorizedRouterRevertsForZeroAddress() public {
        vm.prank(OWNER);
        vm.expectRevert(ConvictionHook.ZeroAddress.selector);
        hook.setAuthorizedRouter(address(0));
    }

    function testNonOwnerCannotRegisterMarket() public {
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(OWNABLE_UNAUTHORIZED_ACCOUNT_SELECTOR, STRANGER));
        hook.registerMarket(address(0xC0FFEE));
    }

    function testGetHookPermissionsReturnsExpectedBooleans() public view {
        Hooks.Permissions memory permissions = hook.getHookPermissions();

        assertFalse(permissions.beforeInitialize);
        assertTrue(permissions.afterInitialize);
        assertFalse(permissions.beforeAddLiquidity);
        assertTrue(permissions.afterAddLiquidity);
        assertFalse(permissions.beforeRemoveLiquidity);
        assertFalse(permissions.afterRemoveLiquidity);
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertFalse(permissions.beforeDonate);
        assertFalse(permissions.afterDonate);
        assertFalse(permissions.beforeSwapReturnDelta);
        assertFalse(permissions.afterSwapReturnDelta);
        assertFalse(permissions.afterAddLiquidityReturnDelta);
        assertFalse(permissions.afterRemoveLiquidityReturnDelta);
    }

    function testBeforeSwapReturnsSelectorZeroDeltaAndNoFeeOverride() public {
        PoolKey memory key = _poolKey();
        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: 1});

        vm.prank(POOL_MANAGER);
        (bytes4 selector, BeforeSwapDelta delta, uint24 feeOverride) = hook.beforeSwap(SWAPPER, key, params, hex"");

        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(BeforeSwapDelta.unwrap(delta), BeforeSwapDelta.unwrap(BeforeSwapDeltaLibrary.ZERO_DELTA));
        assertEq(feeOverride, 0);
    }

    function testAfterSwapEmitsObservationEvent() public {
        PoolKey memory key = _poolKey();
        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: 1});
        bytes32 poolId = PoolId.unwrap(key.toId());

        vm.expectEmit(true, true, false, false, address(hook));
        emit HookSwapObserved(poolId, SWAPPER);

        vm.prank(POOL_MANAGER);
        (bytes4 selector, int128 unspecifiedDelta) =
            hook.afterSwap(SWAPPER, key, params, BalanceDeltaLibrary.ZERO_DELTA, hex"");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(unspecifiedDelta, 0);
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

    function _poolKey() internal view returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }
}
