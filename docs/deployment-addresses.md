# Conviction Deployment Addresses

Network: X Layer mainnet  
Chain ID: 196

| Component | Address |
| --- | --- |
| Uniswap v4 PoolManager | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| Uniswap v4 PositionManager | `0xcf1eafc6928dc385a342e7c6491d371d2871458b` |
| Uniswap v4 StateView | `0x76fd297e2d437cd7f76d50f01afe6160f86e9990` |
| ConvictionCreate2Deployer | `0x06e8e54674a7456fd93a0c512bd1d215720a8fae` |
| ConvictionHook | `0xcfa1e4f193b93b8822837f132828245f0ef314c0` |
| ConvictionRouter | `0x67aadd728b7774a5985e653fa2f4d9661dc5242a` |
| ConvictionMarketFactory | `0x9441f3e577b3d914e4563a8e5c3a6ca9c4421319` |
| ConvictionMarketManager | `0xd9397a0d9872ef7888c221b3758b833c43a656a1` |
| DemoJourneyController | `0x67123f7d2a03dd64397287a14dc5ffa88a89376d` |
| DemoCollateral | `0x381734768da85de012ffec4f296f17d52899e32e` |
| ManualResolver | `0xcfd6553812c2f489539f62a75a5787fe9b51f8aa` |
| DemoPoolBootstrapper | `0x0aa068bf1bf5f8d0174558021e34097882ecae0e` |
| DemoPool token A | `0x4b9a2e4c384BD45bb224BD3cfd65Af54B121E012` |
| DemoPool token B | `0x5ff280C26bB357C8d547A26380bfefB0C187f241` |
| DemoPool currency0 | `0x4b9a2e4c384BD45bb224BD3cfd65Af54B121E012` |
| DemoPool currency1 | `0x5ff280C26bB357C8d547A26380bfefB0C187f241` |
| DemoPool PoolId | `0x21b0f44cc596f3c07218ac2cacc356517c34618e9b5bc777f1ffe32fdf0947b4` |
| DemoMarket | `0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c` |
| DemoMarket MarketId | `0xba58f82028c6728b2ec7e803e794eac6fbf3f4cc74300a589f1afedc315e124a` |
| YES Token | `0x99A93b24cCcd179173C54B81949a13dfD96FD9ee` |
| NO Token | `0xec8217a862BBBf6a81157F53663EabCAF6073de5` |
| Final lifecycle evidence market | `0xc1D5670Ca9D34285EB379f73c68EDEdABb563060` |
| Final lifecycle MarketId | `0xee9b2440cd65ca288a8df0a0c6dbc94babd28b7e735b53a226884d3180b78600` |
| Final lifecycle YES Token | `0x2B6511306Ed1438035fe4eB82a4aF007fE1E8208` |
| Final lifecycle NO Token | `0x9b49FDF7BFA509c851755D38079585b5c52B955F` |

## Demo transaction evidence

| Action | Transaction | Evidence |
| --- | --- | --- |
| Enter YES | `0x7b2dfe02b1343b602fc76e6af6000be03d1ba6e2013360db15f528eec8ccc0d5` | PoolManager `Swap`, Hook `HookSwapObserved`, Market `ConvictionEntered` |
| Exit YES | `0x5389de22ff4b21694c57fe414b6a9e5d650e0e35f5be861df7a6c2dec55b67c2` | PoolManager `Swap`, Hook `HookSwapObserved`, Market `ConvictionExited` |
| Deploy manager | `0x98be69bfb9fd6e0ba2afd5970b35125afb44378c13781dadf4990e003e5b059f` | Deployed `ConvictionMarketManager` |
| Transfer Hook ownership | `0x6cec3c84c22799b4ee635cb62bb1b900b2277aa6a1dfc5dc33859f87c0adf5d1` | `ConvictionHook.owner()` now returns Manager |
| Legacy Demo Journey fresh market | `0x7d6a0023656c76a24b83d28fc4d3dcc65cf73c87c63a9c0cf8eb9ac705ca5402` | Previous controller fallback market before wallet-scoped demo sessions |
| Demo Session stack deploy | `0x065b1ce41d0b485de1dcfe8b74403d128c57979c6d5b6b7e813c06da39250fc7` ... `0x73251b469fbe95e804e7ac35aabb9b93a2c0a4320d1d48be895b978b0dd43615` | Full stack redeployed with wallet-scoped `DemoJourneyController.startDemoSession()` |
| Final lifecycle create/register | `0x3e34a427509c15bd31745e8346c0b74b0e82ad0a65e3740f376cbf387d994eb1` | Manager `createMarketAndRegister`, Hook `MarketRegistered` |
| Final lifecycle enter YES | `0xab08592daa7480933927896462e8bf16c9d603a806aeb1619335a99329ac6629` | Router `enterMarket`, PoolManager `Swap`, Hook `HookSwapObserved`, Market `ConvictionEntered` |
| Final lifecycle resolver outcome | `0xd85e2d247833ede4571bcdb83cd3231e970c4df6288ee459b20c4238766dc407` | ManualResolver `OutcomeSet`, winning outcome YES |
| Final lifecycle resolve | `0x5634323ff6b6c90ab755f6e0b2422230b643d3e38934ce83008f89107db37b17` | Market `resolve`, winning outcome YES |
| Final lifecycle claim | `0xbf1c6b97802c253444019ea12cafbc9d87bad8171bdc94155a7f9148e041dd62` | Market `claim`, claimed `2000000000000000000` cUSDC |

Post-trade state for demo trader `0xf75C00b432179483CF667af7C7eF53EFEe89ef31`:

- Remaining YES amount: `1000000000000000000`
- Remaining YES weight: `1493610149675298366`
- Market collateral pool: `1025300000000000000`

## Deployment notes

- Current frontend config points to the wallet-scoped Demo Session stack deployed with [DeployDemoJourneyStack.s.sol](../script/DeployDemoJourneyStack.s.sol). The current controller fallback market is `0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c`, and each connected wallet can create an independent `DemoJourneyController.startDemoSession()` market so one user's settlement cannot block the next user's demo.
- Deploy `ConvictionHook` through the CREATE2 deployer in [DeployConviction.s.sol](../script/DeployConviction.s.sol) so the hook address has the required Uniswap v4 permission bits.
- The wallet-scoped demo stack has `ConvictionHook.owner() == 0xd9397A0d9872EF7888c221B3758B833C43A656A1` and `ConvictionMarketManager.owner() == 0x67123f7d2A03Dd64397287A14Dc5fFA88A89376d`.
- Deploy `DemoJourneyController` with [DeployDemoJourneyController.s.sol](../script/DeployDemoJourneyController.s.sol) for the public `/demo` onboarding flow, then set `VITE_DEMO_JOURNEY_CONTROLLER` in the frontend environment.
- Use [demo-journey-deploy-runbook.md](demo-journey-deploy-runbook.md) for the full deploy/backfill/evidence sequence, and run [VerifyDemoJourney.s.sol](../script/VerifyDemoJourney.s.sol) after the broadcast to confirm mint ownership, manager ownership, Hook registration, authorized router, factory registration, and YES/NO token bytecode.
- After deployment, `ConvictionHook.authorizedRouter()` must equal `ConvictionRouter`.
- Bootstrap the demo v4 pool with [BootstrapDemoPool.s.sol](../script/BootstrapDemoPool.s.sol) after deploying the Hook, then reuse the printed `currency0`, `currency1`, fee, tick spacing, and Hook as the PoolKey for Router entry and exit.
- After demo market creation, the market must be registered in `ConvictionHook.registeredMarkets(market)` before frontend or Agentic Wallet trading.
- The submitted mainnet factory predates the local manager-assignment patch, so final lifecycle settlement uses the canonical `ManualResolver.setOutcome -> ConvictionMarket.resolve -> ConvictionMarket.claim` path after deadline. Local and future deployments should use the current factory code path where managed markets report `ConvictionMarket.manager() == ConvictionMarketManager`.
- Entry and exit evidence for judging must include a real X Layer `PoolManager.swap` transaction and the emitted `HookSwapObserved` plus `ConvictionEntered` or `ConvictionExited` events.
