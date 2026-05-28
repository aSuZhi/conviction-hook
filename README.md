# Conviction

Conviction is a Uniswap v4 Hook-native event asset protocol deployed on X Layer.

Prediction markets usually reward only correctness. Conviction rewards being right, early, and committed. Users enter and exit YES/NO event exposure through a real Uniswap v4 swap path. The Conviction Hook observes that path, enforces market lifecycle rules, and turns swap activity into conviction-weighted settlement accounting.

The result is not a simple prediction-market frontend on top of a standalone contract. Conviction makes event exposure a Hook-native asset behavior: the trade path itself creates, updates, freezes, taxes, and proves the market state.

## Hackathon fit

Conviction was built for Hook the Future, where projects are evaluated on Hook innovation, potential market value, and completion.

| Dimension | Conviction answer |
| --- | --- |
| Innovation | A Uniswap v4 Hook turns swaps into conviction-weighted event asset accounting. Entry and exit are not ordinary ERC-20 transfers or backend orders; they must pass through PoolManager and Hook callbacks. |
| Potential market value | Conviction targets prediction markets, event assets, creator markets, AI-traded markets, and time-sensitive conviction games on X Layer. It creates recurring user demand: discover markets, enter early, manage exits, settle, claim, and let agents operate strategies. |
| Completion | Contracts are deployed on X Layer mainnet, tested with Foundry, verified through deployment scripts, and exposed through a production DApp, operator Studio, guided demo journey, and Agent Skill. Hook behavior is triggered by real transactions. |

## Why this is different from a traditional prediction market

Traditional prediction markets usually separate market logic from the exchange path:

- A user buys YES/NO shares from an order book or AMM.
- The trading venue updates balances.
- Resolution later makes winning shares redeemable.
- Market rules mostly live in market contracts, relayers, order books, or backend services.

Conviction changes that shape:

- **The Hook is the market gate.** Entry and exit must route through Uniswap v4 `PoolManager.swap`, with the market intent carried in `hookData`.
- **Shares are not the whole story.** Users accumulate conviction weight based on side, size, timing, and commitment.
- **Exiting is part of the game.** Exit tax discourages late opportunistic exits and makes timing a protocol-level mechanic.
- **Lifecycle is Hook-enforced.** Paused, voided, expired, and resolved markets are rejected in the Hook path.
- **Settlement is weighted.** Winning claims are based on settlement weight rather than simply transferable share balance.
- **The evidence is onchain.** The same route can be inspected by judges, users, and AI agents: Router -> PoolManager -> Hook -> Market.

## Product surface

Conviction ships as a full DApp, not just contracts.

- **Markets**: discover live, bettable, ending-soon, resolved, and user-position markets.
- **Market detail**: conviction-over-time, outcome curve, exit tax, user position, lifecycle proof, settlement math, and trade panel.
- **Portfolio**: wallet-level positions, PnL-style summaries, exposure, and claimable outcomes.
- **Activity**: transaction and market event feed.
- **Demo Journey**: judge/user onboarding flow with wallet-scoped demo markets, demo collateral, buy/sell, settlement, and claim.
- **Market Studio**: separated operator interface for creating, pausing, voiding, resolving, and inspecting markets.
- **Agent Skill**: natural-language agent integration for operating Conviction markets with an OKX Agentic Wallet.

## Hook-native mechanism

The critical path is:

```text
User or Agent
  -> ConvictionRouter.enterMarket / exitMarket
  -> Uniswap v4 PoolManager.unlock
  -> Uniswap v4 PoolManager.swap
  -> ConvictionHook.beforeSwap / afterSwap
  -> ConvictionMarket.enter / exit accounting
```

The Hook does three things that make Conviction native to v4:

1. **Before swap**: decodes market intent, validates lifecycle, rejects non-bettable markets, and blocks expired or resolved entries.
2. **PoolManager swap**: creates the real v4 swap event and ties the market action to X Layer liquidity infrastructure.
3. **After swap**: records entry or exit accounting, emits proof events, updates conviction state, and links user action to settlement math.

Direct calls to `ConvictionMarket.enter` and `ConvictionMarket.exit` are rejected unless they come from the registered Hook path.

## Contracts

| Contract | Role |
| --- | --- |
| `ConvictionHook` | Uniswap v4 Hook that validates lifecycle and records swap-triggered market accounting. |
| `ConvictionRouter` | User-facing entry/exit router that passes market intent into the v4 swap path. |
| `ConvictionMarket` | YES/NO market accounting, conviction weights, exits, settlement, and claims. |
| `ConvictionMarketFactory` | Creates markets bound to the canonical Hook and records known markets. |
| `ConvictionMarketManager` | Operator control plane for create/register/pause/void/resolve without bypassing Hook trading. |
| `OutcomeToken` | Non-transferable YES/NO exposure representation. |
| `ManualResolver` | Hackathon/demo resolver. |
| `DemoJourneyController` | Wallet-scoped demo session flow for judges and new users. |
| `DemoCollateral` | Capped demo collateral used by the guided experience. |

## X Layer mainnet deployment

| Component | Address |
| --- | --- |
| Uniswap v4 PoolManager | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| Uniswap v4 PositionManager | `0xcf1eafc6928dc385a342e7c6491d371d2871458b` |
| Uniswap v4 StateView | `0x76fd297e2d437cd7f76d50f01afe6160f86e9990` |
| ConvictionHook | `0xcfa1e4f193b93b8822837f132828245f0ef314c0` |
| ConvictionRouter | `0x67aadd728b7774a5985e653fa2f4d9661dc5242a` |
| ConvictionMarketFactory | `0x9441f3e577b3d914e4563a8e5c3a6ca9c4421319` |
| ConvictionMarketManager | `0xd9397a0d9872ef7888c221b3758b833c43a656a1` |
| DemoJourneyController | `0x67123f7d2a03dd64397287a14dc5ffa88a89376d` |
| Demo collateral | `0x381734768da85de012ffec4f296f17d52899e32e` |
| ManualResolver | `0xcfd6553812c2f489539f62a75a5787fe9b51f8aa` |
| DemoPoolBootstrapper | `0x0aa068bf1bf5f8d0174558021e34097882ecae0e` |
| Current demo market | `0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c` |
| Demo YES token | `0x99A93b24cCcd179173C54B81949a13dfD96FD9ee` |
| Demo NO token | `0xec8217a862BBBf6a81157F53663EabCAF6073de5` |

More details are tracked in [`docs/deployment-addresses.md`](docs/deployment-addresses.md) and [`docs/final-evidence-status.md`](docs/final-evidence-status.md).

## Demo journey

The guided demo page is designed for judges and new users. It avoids the problem of one global demo market being permanently resolved by making the experience wallet-scoped.

Flow:

1. Connect wallet on X Layer.
2. Claim demo collateral, limited to once per wallet per 24 hours.
3. Start a personal demo market session.
4. Buy or sell YES/NO through the Router -> PoolManager -> Hook path.
5. Trigger demo settlement.
6. Claim winning proceeds.
7. Inspect the contract and lifecycle evidence below the user flow.

This gives reviewers a complete onchain lifecycle without needing admin access or a centralized backend.

## Agent Skill

Conviction also includes an Agent Skill so an AI agent can discover markets, open a demo session, claim demo funds, trade, settle, claim, and report transaction evidence through natural language.

Public skill repository:

```text
https://github.com/aSuZhi/conviction-agentic-wallet
```

Install command:

```bash
npx skills add aSuZhi/conviction-agentic-wallet
```

A copy is included under [`agent-skill/conviction-agentic-wallet`](agent-skill/conviction-agentic-wallet) for review convenience.

## Repository layout

```text
src/          Hook, market, router, manager, resolver, token, and demo contracts
script/       Foundry deployment, lifecycle, and verification scripts
test/         Foundry unit and integration tests
app/          React/Vite DApp, Studio, demo journey, and browser verification tests
docs/         Deployment evidence, runbooks, demo script, and submission material
agent-skill/  Conviction Agent Skill copy plus public repo link
```

## Local setup

Install Foundry dependencies:

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
```

Install JavaScript dependencies:

```bash
pnpm install
pnpm --dir app install
```

Copy environment template:

```bash
cp .env.example .env
```

Never commit `.env`.

## Test and build

Contracts:

```bash
forge test -vv
forge build
```

Frontend:

```bash
pnpm --dir app run test:unit
pnpm --dir app run test:wallet
pnpm --dir app run build
```

X Layer verification:

```bash
forge script script/VerifyAddresses.s.sol:VerifyAddresses --rpc-url xlayer
forge script script/VerifyDemoJourney.s.sol:VerifyDemoJourney --rpc-url xlayer -vv
```

Current local verification status:

- `forge test -vv`: 80 passing tests.
- `pnpm --dir app run test:unit`: passing.
- `pnpm --dir app run test:wallet`: passing.
- `pnpm --dir app run build`: passing.
- X Layer address verification: passing.
- Demo journey verification: passing.

## Frontend deployment

The DApp is a static Vite app.

Recommended Vercel settings:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | `app` |
| Build command | `pnpm run build` |
| Output directory | `dist` |

The production deployment should expose:

- `/markets`
- `/markets/:address`
- `/portfolio`
- `/activity`
- `/demo`
- `/agent`
- `/studio`

## Security and limitations

This is a hackathon deployment and should be reviewed before handling real user funds at scale.

Current design choices:

- Demo collateral is capped.
- Outcome exposure is non-transferable.
- Direct market entry/exit is blocked outside the Hook route.
- Operator actions are manager-gated.
- Demo resolution is manual for review speed.
- Exact approvals are used by the frontend flow.

Known production hardening work:

- Replace manual resolution with a robust oracle or dispute process.
- Add formal verification or third-party audit.
- Add richer indexing infrastructure for long-running market analytics.
- Add rate limits and abuse monitoring for demo collateral.
- Expand liquidity bootstrapping beyond demo pools.

## Submission materials

- Submission narrative: [`docs/submission.md`](docs/submission.md)
- Demo video script: [`docs/demo-script.md`](docs/demo-script.md)
- Demo runbook: [`docs/demo-runbook.md`](docs/demo-runbook.md)
- Demo journey runbook: [`docs/demo-journey-deploy-runbook.md`](docs/demo-journey-deploy-runbook.md)
- Agentic Wallet demo: [`docs/agentic-wallet-demo.md`](docs/agentic-wallet-demo.md)
- Evidence tracker: [`docs/final-evidence-status.md`](docs/final-evidence-status.md)

## One-sentence pitch

Conviction turns prediction markets into Hook-native event assets: every entry and exit travels through Uniswap v4 on X Layer, while the Hook records who was right, who was early, who stayed committed, and how settlement should reward them.
