# Conviction Final Evidence Status

This file is the current source of truth for the final-submission evidence gate.

## Technical Verification

| Gate | Evidence | Status |
| --- | --- | --- |
| Solidity test suite | `forge test` | Passed: 80 tests, 0 failed |
| Frontend unit tests | `npm --prefix app run test:unit` | Passed |
| Frontend production build | `npm --prefix app run build` | Passed |
| Route and mobile browser verification | `$env:CONVICTION_APP_URL='http://127.0.0.1:5175'; $env:CONVICTION_MOCK_RPC='1'; node app/tests/verify-pages.mjs` | Passed in mock RPC mode against the local preview |
| Wallet, portfolio, claim CTA, receipt activity | `npm --prefix app run test:wallet` | Passed with deterministic mock EIP-1193 wallet |
| X Layer address verification | `forge script script/VerifyAddresses.s.sol:VerifyAddresses --rpc-url xlayer` | Passed; bytecode present for Hook, Router, Factory, Manager, DemoCollateral, Resolver, and DemoMarket |
| Demo Journey deployment verification | `forge script script/VerifyDemoJourney.s.sol:VerifyDemoJourney --rpc-url https://rpc.xlayer.tech -vv` | Passed for wallet-scoped Controller `0x67123f7d2a03dd64397287a14dc5ffa88a89376d`, fallback Market `0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c`, and session duration `604800` |

## X Layer Mainnet Evidence

| Requirement | Evidence | Status |
| --- | --- | --- |
| X Layer deployed contract addresses | `docs/deployment-addresses.md` | Filled for wallet-scoped Hook, Router, Factory, Manager, Controller, Resolver, DemoCollateral, DemoPool, DemoMarket, YES, NO |
| User enter transaction | `0x7b2dfe02b1343b602fc76e6af6000be03d1ba6e2013360db15f528eec8ccc0d5` | Mainnet evidence recorded |
| User exit transaction | `0x5389de22ff4b21694c57fe414b6a9e5d650e0e35f5be861df7a6c2dec55b67c2` | Mainnet evidence recorded |
| Hook/Market event evidence | `docs/deployment-addresses.md` event notes for PoolManager `Swap`, Hook `HookSwapObserved`, Market `ConvictionEntered` / `ConvictionExited` | Mainnet evidence recorded |
| ConvictionMarketManager deployment | Manager `0x9a55bDc4f8f613cAe059309Ff1F58eb7F9d2E50F`; deploy tx `0x98be69bfb9fd6e0ba2afd5970b35125afb44378c13781dadf4990e003e5b059f`; ownership tx `0x6cec3c84c22799b4ee635cb62bb1b900b2277aa6a1dfc5dc33859f87c0adf5d1` | Mainnet evidence recorded |
| Final lifecycle market | Market `0xc1D5670Ca9D34285EB379f73c68EDEdABb563060`; create/register tx `0x3e34a427509c15bd31745e8346c0b74b0e82ad0a65e3740f376cbf387d994eb1`; enter tx `0xab08592daa7480933927896462e8bf16c9d603a806aeb1619335a99329ac6629` | Mainnet evidence recorded |
| Settlement or claim transaction | Outcome tx `0xd85e2d247833ede4571bcdb83cd3231e970c4df6288ee459b20c4238766dc407`; resolve tx `0x5634323ff6b6c90ab755f6e0b2422230b643d3e38934ce83008f89107db37b17`; claim tx `0xbf1c6b97802c253444019ea12cafbc9d87bad8171bdc94155a7f9148e041dd62`; post-claim read shows `resolved=true`, `winningOutcome=1`, `claimable=0`, `claimed=true` | Mainnet evidence recorded |
| Agentic Wallet transaction | `/agent` Conviction Agent Skill page, `.agents/skills/conviction-agentic-wallet`, and helper CLI exist | Skill and proof surface are ready; final Agentic Wallet mainnet evidence still requires an imported Agent-produced tx hash |

## Residual Evidence Note

Agentic Wallet execution evidence is explicitly not submitted in this package unless a later `/agent` import adds a real transaction hash. The Agent Skill package and helper CLI are implemented for judging, but imported Agent-produced tx evidence is still the final proof gate.

## Market Detail Data Panel

The `/markets/:address` detail page now renders conviction history from `ProbabilityUpdated` logs when available, shows an explicit no-history state when the current RPC returns no historical events, hydrates Hook path proof from transaction receipts, reads mechanism state directly from market contracts, and gates trading through wallet/network/market/balance readiness. Static chart points and hard-coded trade preview multipliers were removed.

## Demo Journey Verification

- Demo route: `/demo`
- Backwards compatible route: `/judge`
- Controller: `0x67123f7d2a03dd64397287a14dc5ffa88a89376d`
- Fallback demo market: `0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c`
- Demo session stack deploy tx sequence: `0x065b1ce41d0b485de1dcfe8b74403d128c57979c6d5b6b7e813c06da39250fc7` ... `0x73251b469fbe95e804e7ac35aabb9b93a2c0a4320d1d48be895b978b0dd43615`
- Fallback YES token: `0x99A93b24cCcd179173C54B81949a13dfD96FD9ee`
- Fallback NO token: `0xec8217a862BBBf6a81157F53663EabCAF6073de5`
- Demo Factory: `0x9441f3e577b3d914e4563a8e5c3a6ca9c4421319`
- Demo Hook: `0xcfa1e4f193b93b8822837f132828245f0ef314c0`
- Demo Router: `0x67aadd728b7774a5985e653fa2f4d9661dc5242a`
- Demo Manager: `0xd9397a0d9872ef7888c221b3758b833c43a656a1`
- Demo Collateral: `0x381734768da85de012ffec4f296f17d52899e32e`
- Demo Resolver: `0xcfd6553812c2f489539f62a75a5787fe9b51f8aa`
- Deployment runbook: `docs/demo-journey-deploy-runbook.md`
- Post-deploy verifier: `script/VerifyDemoJourney.s.sol`
- Claim rule: one successful `claimDemoTokens()` per wallet per 24 hours
- Session rule: each connected wallet calls `DemoJourneyController.startDemoSession()` to create its own registered market; once that market is resolved, voided, or expired, the same wallet can start a new round.
- Trade path: `ConvictionRouter -> PoolManager.swap -> ConvictionHook -> ConvictionMarket`
- Settlement path: `DemoJourneyController.settleDemoMarket -> ConvictionMarketManager.earlyResolveMarket -> ConvictionMarket.earlyResolve` on `demoMarketOf(msg.sender)`
- Contract proof: bottom section contains Controller, Hook, Router, Factory, Manager, Market, YES/NO tokens, Resolver, and PoolKey
- No-state chain probes passed with `cast call`: `demoMarket()` returns `0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c`, `sessionDuration()` returns `604800`, `resolver()` returns `0xcfd6553812c2f489539f62a75a5787fe9b51f8aa`, `market.manager()` returns `0xd9397a0d9872ef7888c221b3758b833c43a656a1`, and `hook.registeredMarkets(demoMarket)` returns `true`.

### Latest Demo Journey Tx Hashes

- Claim demo funds: pending manual X Layer verification
- Buy or sell: pending manual X Layer verification
- Settle demo market: pending manual X Layer verification
- Claim winnings: pending manual X Layer verification
