# Demo Journey Deployment Runbook

This runbook turns the `/demo` user journey into a real X Layer flow:

1. connect OKX Wallet on X Layer,
2. claim demo cUSDC and demo pool tokens once per wallet per 24 hours,
3. buy or sell the preset market through `ConvictionRouter -> PoolManager.swap -> ConvictionHook -> ConvictionMarket`,
4. trigger demo settlement through `DemoJourneyController`,
5. claim winnings from `ConvictionMarket`.

## Prerequisites

- `.env` contains `DEPLOYER_PRIVATE_KEY`.
- `VITE_CONVICTION_HOOK_ADDRESS`, `VITE_CONVICTION_ROUTER_ADDRESS`, `VITE_CONVICTION_FACTORY_ADDRESS`, `VITE_CONVICTION_MANAGER_ADDRESS`, `VITE_CONVICTION_RESOLVER_ADDRESS`, and `VITE_DEMO_COLLATERAL_TOKEN` point to the current X Layer mainnet deployment.
- `ConvictionHook.owner()` is the deployed `ConvictionMarketManager`.
- The deployer currently owns `DemoCollateral` and `ConvictionMarketManager` before the journey deployment.

## Deploy

For a fresh production-grade demo stack, deploy all current-version contracts together:

```powershell
$env:DEMO_JOURNEY_MARKET_DURATION_SECONDS='604800'
forge script script/DeployDemoJourneyStack.s.sol:DeployDemoJourneyStack --rpc-url https://rpc.xlayer.tech --broadcast -vv
```

Use the narrower controller-only script only when the configured `ConvictionMarketFactory` is already the current managed-market version. The first mainnet factory deployed for this project predates `ConvictionMarket.manager()` and `earlyResolve(...)`, so controller-only deployment is not enough for the full `/demo` settlement flow.

Controller-only deployment command:

```powershell
$env:DEMO_JOURNEY_DEPLOY_POOL='true'
$env:DEMO_JOURNEY_CREATE_MARKET='true'
$env:DEMO_JOURNEY_TRANSFER_COLLATERAL_OWNER='true'
$env:DEMO_JOURNEY_TRANSFER_MANAGER_OWNER='true'
$env:DEMO_JOURNEY_TRANSFER_BOOTSTRAPPER_OWNER='false'
$env:DEMO_JOURNEY_MARKET_DURATION_SECONDS='604800'
forge script script/DeployDemoJourneyController.s.sol:DeployDemoJourneyController --rpc-url https://rpc.xlayer.tech --broadcast -vv
```

Expected printed values:

- `DemoJourneyController`
- `DemoJourneyBootstrapper`
- `DemoJourneyMarket`
- `DemoPoolTokenA`
- `DemoPoolTokenB`
- `DemoPoolCurrency0`
- `DemoPoolCurrency1`
- `DemoPoolId`

## Frontend Env Backfill

After deployment, set these values in `.env`:

```dotenv
VITE_DEMO_JOURNEY_CONTROLLER=<DemoJourneyController>
VITE_DEMO_POOL_BOOTSTRAPPER=<DemoJourneyBootstrapper>
VITE_CONVICTION_MARKET_ADDRESS=<DemoJourneyMarket>
VITE_DEMO_POOL_CURRENCY0=<DemoPoolCurrency0>
VITE_DEMO_POOL_CURRENCY1=<DemoPoolCurrency1>
VITE_DEMO_YES_TOKEN=<DemoJourneyMarket yesToken()>
VITE_DEMO_NO_TOKEN=<DemoJourneyMarket noToken()>
```

Then rebuild and restart the static preview:

```powershell
npm --prefix app run build
node app/scripts/preview-static.mjs
```

## Verify

Run the post-deploy verifier:

```powershell
forge script script/VerifyDemoJourney.s.sol:VerifyDemoJourney --rpc-url https://rpc.xlayer.tech -vv
```

It must pass these checks:

- `DemoJourneyController` has bytecode.
- `controller.collateral()` matches `DemoCollateral`.
- `controller.manager()` matches `ConvictionMarketManager`.
- `controller.bootstrapper()` is set and owned by the controller.
- `DemoCollateral.owner()` is the controller.
- `ConvictionMarketManager.owner()` is the controller.
- `ConvictionHook.owner()` is still the manager.
- `ConvictionHook.authorizedRouter()` is `ConvictionRouter`.
- `ConvictionHook.registeredMarkets(demoMarket)` is true.
- `ConvictionMarketFactory.isMarket(demoMarket)` is true.
- `ConvictionMarket.manager()` is the manager.
- The demo market has YES/NO token bytecode.

## Evidence Capture

Use `/demo` and capture four transaction hashes:

- Claim demo funds: `DemoJourneyController.claimDemoTokens()`.
- Buy or sell: `ConvictionRouter.enterMarket()` or `ConvictionRouter.exitMarket()`.
- Settle demo market: `DemoJourneyController.settleDemoMarket()`.
- Claim winnings: `ConvictionMarket.claim()`.

Record hashes in `docs/final-evidence-status.md` under **Latest Demo Journey Tx Hashes**.

## Operational Note

The public settlement button resolves the currently configured demo market. After it is settled, deploy or create a fresh demo market before inviting another new judge/user to repeat the full trade-before-settle flow.
