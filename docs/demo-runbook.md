# Conviction Demo Runbook

Purpose: give judges a deterministic 3-minute path that proves Conviction is Hook-native, deployed for X Layer, and able to show the full market lifecycle.

## Browser Path

1. Open `/markets` and select the OKB demo market.
2. Open `/markets/:address` and show the Conviction Engine, Hook path, exit tax, and settlement math panels.
3. Enter a small YES position from the trade ticket.
4. Open `/judge` and confirm the transaction appears as evidence.
5. Show the PoolManager, Hook, and Market evidence columns.
6. Open `/agent` and show imported Agentic Wallet evidence or the required Agentic task.
7. Return to `/portfolio` and show position value, claimable state, and honest PnL status.

## Lifecycle Proof Path

1. Create or select the OKB demo market.
2. Alice enters YES early.
3. Bob enters later.
4. Alice exits part of the position and pays exit tax.
5. Deadline passes or freeze is simulated in local demo.
6. A new swap attempt is rejected after freeze.
7. Resolver submits the winning outcome.
8. Winner claims from the collateral pool.
9. Evidence Center shows transaction hashes and Hook event proof.
10. Agent Console shows one Agentic Wallet operation.

## Commands

```powershell
forge test
npm --prefix app run test:unit
npm --prefix app run build
npm --prefix app run test:wallet
npm --prefix app run dev -- --host 127.0.0.1
```

In restricted sandboxes without X Layer RPC access, run browser route verification with:

```powershell
$env:CONVICTION_MOCK_RPC='1'
node app/tests/verify-pages.mjs
```

Use the existing deployment scripts for live or forked X Layer demos:

```powershell
forge script script/DeployConviction.s.sol:DeployConviction --rpc-url xlayer --broadcast
forge script script/DeployConvictionManager.s.sol:DeployConvictionManager --rpc-url xlayer --broadcast
forge script script/BootstrapDemoPool.s.sol:BootstrapDemoPool --rpc-url xlayer --broadcast
forge script script/CreateDemoMarket.s.sol:CreateDemoMarket --rpc-url xlayer --broadcast
```

For the submitted final lifecycle proof, use the manager-created short market and the canonical resolver settlement path:

```powershell
$env:DEMO_EXIT_AMOUNT='0'
$env:LIFECYCLE_MARKET_DURATION_SECONDS='300'
forge script script/RunManagedLifecycle.s.sol:RunManagedLifecycle --rpc-url xlayer --broadcast

$env:LIFECYCLE_MARKET_ADDRESS='0xc1D5670Ca9D34285EB379f73c68EDEdABb563060'
forge script script/ResolveAndClaimLifecycle.s.sol:ResolveAndClaimLifecycle --rpc-url xlayer --broadcast
```

## Evidence Required

- ConvictionHook address.
- ConvictionRouter address.
- Market Factory and Manager addresses.
- Demo market address.
- YES and NO token addresses.
- At least one enter transaction hash.
- At least one Hook-observed receipt or event proof.
- Settlement or claim evidence for the demo path.
- Agentic Wallet evidence, or an explicit note that it was not submitted.

Current final evidence status is tracked in [final-evidence-status.md](final-evidence-status.md).
