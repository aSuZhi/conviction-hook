// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {DemoCollateral} from "../src/DemoCollateral.sol";

contract DemoPoolBootstrapper is Ownable, IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using SafeERC20 for IERC20;

    error NotOwner();
    error NotPoolManager();
    error UnexpectedSettleAmount();

    uint160 public constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 public constant FEE = 3000;
    int24 public constant TICK_SPACING = 60;
    int24 public constant TICK_LOWER = -120;
    int24 public constant TICK_UPPER = 120;

    IPoolManager public immutable poolManager;
    IHooks public immutable hook;
    DemoCollateral public immutable tokenA;
    DemoCollateral public immutable tokenB;
    PoolKey public poolKey;
    bool public bootstrapped;

    constructor(IPoolManager poolManager_, IHooks hook_, address owner_) Ownable(owner_) {
        poolManager = poolManager_;
        hook = hook_;
        tokenA = new DemoCollateral(address(this));
        tokenB = new DemoCollateral(address(this));
    }

    function bootstrap(uint256 mintAmount, int256 liquidityDelta) external onlyOwner {
        tokenA.mint(address(this), mintAmount);
        tokenB.mint(address(this), mintAmount);

        (Currency currency0, Currency currency1) = _sortedCurrencies(address(tokenA), address(tokenB));
        poolKey =
            PoolKey({currency0: currency0, currency1: currency1, fee: FEE, tickSpacing: TICK_SPACING, hooks: hook});

        poolManager.initialize(poolKey, SQRT_PRICE_1_1);
        poolManager.unlock(abi.encode(liquidityDelta));
        bootstrapped = true;
    }

    function mintDemoPoolTokens(address to, uint256 amount) external onlyOwner {
        tokenA.mint(to, amount);
        tokenB.mint(to, amount);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        int256 liquidityDelta = abi.decode(data, (int256));
        (BalanceDelta callerDelta,) = poolManager.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liquidityDelta: liquidityDelta, salt: bytes32(0)
            }),
            bytes("")
        );

        _settleOrTake(poolKey.currency0, callerDelta.amount0());
        _settleOrTake(poolKey.currency1, callerDelta.amount1());

        return abi.encode(callerDelta);
    }

    function poolId() external view returns (bytes32) {
        return PoolId.unwrap(poolKey.toId());
    }

    function _settleOrTake(Currency currency, int128 delta) internal {
        if (delta < 0) {
            uint256 amount = uint256(SafeCast.toUint128(-delta));
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), amount);
            uint256 paid = poolManager.settle();
            if (paid != amount) revert UnexpectedSettleAmount();
        } else if (delta > 0) {
            poolManager.take(currency, address(this), SafeCast.toUint128(delta));
        }
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
}

contract BootstrapDemoPool is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        IPoolManager poolManager = IPoolManager(vm.envAddress("XLAYER_MAINNET_V4_POOL_MANAGER"));
        IHooks hook = IHooks(vm.envAddress("VITE_CONVICTION_HOOK_ADDRESS"));
        uint256 mintAmount = vm.envOr("DEMO_POOL_TOKEN_MINT_AMOUNT", uint256(1_000_000 ether));
        int256 liquidityDelta = int256(vm.envOr("DEMO_POOL_LIQUIDITY_DELTA", uint256(1e18)));

        vm.startBroadcast(deployerKey);
        DemoPoolBootstrapper bootstrapper = new DemoPoolBootstrapper(poolManager, hook, deployer);
        bootstrapper.bootstrap(mintAmount, liquidityDelta);
        vm.stopBroadcast();

        (Currency currency0, Currency currency1,,,) = bootstrapper.poolKey();

        console2.log("DemoPoolBootstrapper", address(bootstrapper));
        console2.log("DemoPoolTokenA", address(bootstrapper.tokenA()));
        console2.log("DemoPoolTokenB", address(bootstrapper.tokenB()));
        console2.log("DemoPoolCurrency0", Currency.unwrap(currency0));
        console2.log("DemoPoolCurrency1", Currency.unwrap(currency1));
        console2.log("DemoPoolFee", bootstrapper.FEE());
        console2.log("DemoPoolTickSpacing", bootstrapper.TICK_SPACING());
        console2.log("DemoPoolId");
        console2.logBytes32(bootstrapper.poolId());
    }
}
