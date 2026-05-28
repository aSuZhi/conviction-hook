# Conviction Design Plan

## Project Summary

**Conviction** is a Uniswap v4 Hook-native event asset protocol deployed on X Layer.

It turns every swap into a belief signal. Users trade short-cycle event outcome assets, and the Hook prices not only probability, but also timing, liquidity pressure, exit behavior, and conviction.

Conviction also integrates OKX Onchain OS Agentic Wallet as an optional agent-driven execution layer. Users can connect a normal wallet for manual interaction, while an AI agent can use Agentic Wallet to check balances, prepare contract calls, enter markets, exit positions, resolve demo markets, and claim winnings through secure TEE-based signing.

Core positioning:

> Prediction markets usually reward correctness. Conviction rewards being right, early, and committed.

## Deployment Strategy

The project should use **X Layer mainnet as the primary hackathon deployment target** because official Uniswap v4 deployment addresses are available on X Layer mainnet, while no official X Layer testnet v4 deployment has been confirmed.

The recommended strategy is:

1. **Local development and integration tests** using Anvil and forked X Layer mainnet state where useful.
2. **X Layer mainnet deployment** for the submitted Conviction Hook, market contracts, demo collateral, and demo market.
3. **X Layer testnet only for non-v4 auxiliary experiments** unless official testnet v4 addresses become available.

Official rules allow deployment on X Layer mainnet or testnet. Since the Hook must integrate with Uniswap v4 and official v4 addresses are confirmed on mainnet, mainnet is the cleaner and more credible submission path.

Confirmed X Layer mainnet v4 addresses:

| Component | Address |
| --- | --- |
| PoolManager | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| PositionManager | `0xcf1eafc6928dc385a342e7c6491d371d2871458b` |
| StateView | `0x76fd297e2d437cd7f76d50f01afe6160f86e9990` |

Mainnet deployment must use conservative demo parameters:

- Small collateral size
- Short demo market duration
- Clear experimental labeling
- Manual or mock resolver only if clearly disclosed
- No claim that the resolver is production-grade
- Dedicated deployer wallet, not a primary personal wallet
- Capped market exposure for demo safety

## Local Development Resources

The project needs the following local resources.

### Required

- **Foundry** for Solidity development, testing, local chain, deployment scripts, and contract verification commands.
- **Node.js LTS** for frontend and TypeScript scripts.
- **pnpm** as the preferred package manager.
- **Git** for source control and final submission hygiene.
- **A wallet extension** such as MetaMask or Rabby for manual mainnet demo interactions.
- **OKX Onchain OS CLI / Agentic Wallet access** for the agent-driven wallet path.
- **X Layer mainnet RPC configuration** and optional testnet RPC for auxiliary tests.
- **A funded deployer wallet** with X Layer mainnet OKB.
- **A funded Agentic Wallet account** with X Layer mainnet OKB for the AI-assisted demo path.
- **Environment variables** for private key, RPC URLs, explorer API key if available, demo account addresses, and Onchain OS credentials if using API-key login.

### Smart Contract Dependencies

- Uniswap v4 core contracts.
- Uniswap v4 periphery contracts if used by the router or deployment scripts.
- OpenZeppelin contracts for ERC20, access control, and safe token utilities.
- A hook address mining or CREATE2 deployment helper, because Uniswap v4 Hook permissions are encoded in the Hook contract address.

### Frontend Dependencies

- React with Vite or Next.js.
- viem for contract reads and writes.
- wagmi for wallet connection if using a richer frontend.
- A simple chart or progress component for probability, collateral pool size, and conviction weight display.

### Optional but Valuable

- A deterministic demo script that can run the entire market lifecycle.
- A local screen recorder for the 1-3 minute demo video.
- A simple event indexing script that reads Hook events and renders market history in the frontend.
- An Agentic Wallet demo script that uses Onchain OS wallet commands to inspect balances and execute Conviction contract interactions.

## Agentic Wallet Integration

Agentic Wallet should be treated as a core product highlight, not only as a convenience wallet.

The product has two interaction modes:

1. **Manual mode** — users connect MetaMask, Rabby, or another EVM wallet and interact with the frontend directly.
2. **Agent mode** — users instruct an AI agent to operate Conviction through OKX Onchain OS Agentic Wallet.

Agent mode is the stronger hackathon narrative because it combines three ingredients from the competition context:

- X Layer as the low-cost execution environment.
- Uniswap v4 Hooks as the market engine.
- OKX Onchain OS Agentic Wallet as the AI-native transaction layer.

### Agent Mode User Story

A user can say:

> Show active Conviction markets on X Layer, enter YES on the OKB market with 5 USDC, exit half before deadline if the exit tax is below 3%, and claim if YES wins.

The agent flow:

1. Check the Agentic Wallet address and balance on X Layer.
2. Read active Conviction market state.
3. Preview conviction multiplier, exit tax, and expected exposure.
4. Prepare the required contract call or frontend transaction.
5. Let Agentic Wallet sign through TEE-based signing.
6. Broadcast the transaction.
7. Track transaction status.
8. Read emitted Hook events and summarize the updated market state.

### Agentic Wallet Capabilities Used

The integration should use Agentic Wallet for:

- Wallet login and account status.
- X Layer address display.
- X Layer balance checks.
- Contract calls for enter, exit, resolve, and claim flows if these are exposed as protocol contract methods.
- Transaction history and status checks after interactions.
- Secure TEE-based signing where the private key never leaves the secure enclave.

### Gas and UX Angle

X Layer currently provides a strong UX angle for Agentic Wallet demos because user interactions can be positioned as low-cost or gas-light execution on an OKX ecosystem L2.

The product narrative should be:

> Conviction lets an AI agent form, execute, monitor, and settle event-asset positions entirely onchain.

### Implementation Boundary

The first-prize implementation should not require the AI agent to replace the frontend. Instead, it should support both paths:

- Frontend path for human judges.
- Agentic Wallet path for AI-native demo differentiation.

Minimum Agentic Wallet deliverable:

- A documented CLI/demo flow showing wallet status, X Layer balance, one Conviction market entry, transaction status, and claim or exit.

Stronger Agentic Wallet deliverable:

- A TypeScript or script-based agent command wrapper that reads market state and calls Conviction contracts through Agentic Wallet.

Stretch Agentic Wallet deliverable:

- Natural-language agent workflow that can monitor a market until deadline and then trigger claim or exit logic according to user-defined rules.

## Hackathon Fit

The project is designed specifically for the Crypto Hackathon 2026 OKX Web3 Developer Challenge, whose core requirement is to build around Uniswap v4 Hooks and deploy on X Layer.

Conviction satisfies the requirement by making the Hook the market engine:

- A Uniswap v4 Pool is bound to each event market.
- A custom Hook controls market lifecycle and swap behavior.
- Hook behavior is triggered by real swaps.
- The Pool and Hook are deployed on X Layer mainnet using official Uniswap v4 mainnet deployment addresses.
- Agentic Wallet can operate the market lifecycle through AI-assisted wallet actions.
- The product creates a new event-asset market structure instead of simply porting an existing prediction market.

## Product Thesis

Traditional prediction markets answer:

> Who guessed correctly?

Conviction answers:

> Who expressed the correct belief earlier, held it longer, and accepted more uncertainty?

This creates a new market structure where event outcomes become liquid assets, and swap activity becomes an onchain conviction signal.

## Target Use Case

The flagship market category is short-cycle crypto-native event markets, because they match X Layer's low gas and high throughput environment.

Primary demo market:

> Will OKB trade above a target price at the deadline?

Additional markets for a more complete product demo:

- BTC 5-minute up/down market
- ETH 1-hour breakout market
- A token reaching a market cap target
- A pool reaching a TVL target
- A project or community event reaching an onchain or social milestone

The first release should support multiple market cards in the frontend, even if only one market is used for the final judging demo.

## Core Market Model

Each market has:

- A question
- A market category
- A collateral token
- A deadline
- A resolver
- Two outcome tokens: YES and NO
- A shared collateral pool
- A resolved outcome state
- Conviction accounting for each user and outcome
- Exit tax accounting
- Market analytics emitted through events

Before settlement, YES and NO are liquid event assets. After settlement, the winning token becomes a claim right against the shared collateral pool, and the losing token becomes worthless.

## First-Prize Scope

The project should be planned as a first-prize release, not only as a minimal MVP.

The scope is divided into four priority levels.

### P0: Official Compliance

These are mandatory for a valid and credible submission:

1. Custom Uniswap v4 Hook.
2. Uniswap v4 Pool bound to the Hook.
3. Deployment on X Layer mainnet.
4. Real swaps that trigger Hook behavior.
5. Verifiable contract addresses.
6. New Hook logic developed during the hackathon.
7. Dedicated X/Twitter account and submission post tagging the required official accounts.

### P1: Conviction Product Core

These are required for the Conviction idea to stand out:

1. Outcome token entry through the swap path.
2. Shared collateral pool accounting.
3. Deadline freeze inside the Hook.
4. Resolver-based settlement.
5. Winner claim.
6. Conviction-weighted payout.
7. Time-aware exit tax.
8. Probability or supply-ratio updates after swaps.

### P2: First-Prize Polish

These features materially improve the chance of competing for first place:

1. Frontend market dashboard.
2. Market creation UI or guided creation script.
3. Enter, exit, resolve, and claim flows in the frontend.
4. Live display of conviction weight and exit tax.
5. Event timeline showing Hook-triggered state changes.
6. Deterministic demo script.
7. Agentic Wallet demo flow for AI-assisted market operation.
8. 1-3 minute demo video.
9. Clear README and deployment address table.
10. Contract tests and integration tests.
11. X Layer mainnet deployment after local and fork validation.

### P3: Stretch Features

These are optional if time remains:

1. Multiple active markets.
2. Multi-outcome markets beyond YES/NO.
3. Optimistic oracle adapter.
4. Event leaderboard for top conviction positions.
5. Transfer-aware conviction accounting.
6. Lightweight indexer for historical market analytics.
7. Agentic Wallet rule-based monitoring, such as auto-claim after resolution or exit when tax is below a user-defined threshold.
8. Mainnet demo market with capped collateral.

## Architecture Overview

The recommended architecture has seven modules.

### 1. ConvictionMarketFactory

Responsibilities:

- Create markets.
- Deploy or register YES and NO outcome tokens.
- Store market metadata.
- Bind markets to Hook-controlled pools.
- Emit `MarketCreated` events.

### 2. ConvictionHook

Responsibilities:

- Enforce market lifecycle rules inside Uniswap v4 swap flow.
- Reject swaps after deadline or resolution.
- Calculate dynamic exit tax.
- Record user conviction checkpoints.
- Update market-side supply or probability state.
- Emit Hook-native market events.

### 3. ConvictionMarket

Responsibilities:

- Hold market configuration.
- Track shared collateral accounting.
- Track outcome supply.
- Track resolution state.
- Compute claimable payouts.
- Coordinate with resolver.

This can be a standalone contract or storage owned by the factory, depending on implementation complexity.

### 4. OutcomeToken

Responsibilities:

- Represent YES and NO outcome assets.
- Allow minting and burning only by trusted protocol contracts.
- Optionally notify the market contract on transfers to update conviction accounting.

For the first release, direct transfers can either be allowed with checkpoint updates or restricted to protocol-mediated transfers. The preferred first-prize design is to keep outcome assets liquid while ensuring transferred tokens do not inherit the sender's conviction bonus.

### 5. Resolver System

Responsibilities:

- Provide the winning outcome after deadline.
- Keep outcome resolution separate from market mechanics.

Required implementations:

- `ManualResolver` for controlled demo resolution.
- `MockPriceResolver` or `PriceResolver` for price-threshold markets.

Future implementation:

- Optimistic resolver with challenge period.
- External oracle adapter.

### 6. Frontend and Demo Scripts

Responsibilities:

- Show market state clearly.
- Make Hook-triggered behavior visible.
- Provide deterministic flows for judging.
- Display contract addresses and transaction hashes.

### 7. Agentic Wallet Operator

Responsibilities:

- Provide an AI-native operation path for Conviction.
- Check wallet status, X Layer address, and balances.
- Prepare and execute Conviction contract interactions through Agentic Wallet.
- Track transaction status after enter, exit, resolve, or claim.
- Summarize Hook events back to the user in natural language.

The Agentic Wallet Operator can start as documentation plus scripts. It does not need to become a fully autonomous production bot during the hackathon.

## Pool Architecture Decision

The implementation should choose the simplest architecture that still makes real swaps trigger the Hook.

Recommended first implementation:

- Use one Hook shared by the event market.
- Use collateral-to-outcome trading paths for YES and NO exposure.
- Keep shared collateral accounting in the market contract.
- Use Hook events to prove that swaps drive market state.

If the available Uniswap v4 deployment and periphery on X Layer support a cleaner single-pool custom accounting design, use that. Otherwise, prioritize a robust two-outcome flow over a theoretically elegant but risky architecture.

The design principle is:

> The Hook must be visibly responsible for market lifecycle and conviction accounting, even if some liquidity mechanics are simplified for the hackathon release.

## Implementation Consistency Rules

These rules prevent conflicts between the Hook, frontend, market contracts, and Agentic Wallet flows.

1. **Market entry and exit must go through the Uniswap v4 swap path.**
   - Frontend entry should call a router or periphery path that triggers the PoolManager swap.
   - Agentic Wallet entry should call the same router or swap-facing contract path.
   - No wallet path should directly mint outcome exposure without triggering the Hook.

2. **Settlement and claim do not need to be swaps.**
   - Resolver submission can call the market or resolver contract directly.
   - Claim can call the market contract directly.
   - These actions should still rely on state created by Hook-triggered entry and exit flows.

3. **Agentic Wallet is an execution layer, not a parallel protocol path.**
   - It should prepare, sign, broadcast, and track the same protocol interactions available to frontend users.
   - It must not bypass conviction accounting, exit tax, deadline freeze, or Hook-triggered events.

4. **Outcome token balances and conviction weight must be separated.**
   - Tokens represent base exposure.
   - Conviction weight is account-specific protocol accounting.
   - Transferring tokens should not transfer historical conviction bonus unless explicitly implemented.

5. **Uniswap v4 deployment availability is a critical external dependency.**
   - Use the confirmed official Uniswap v4 deployments on X Layer mainnet.
   - Do not rely on X Layer testnet for the core v4 Hook demo unless official testnet v4 addresses are later provided.
   - The submitted Pool and Hook must be verifiable on X Layer mainnet.

## Outcome Token and Conviction Accounting

Conviction must not be trivially transferable as a bonus.

Recommended model:

- Outcome tokens represent base exposure.
- Conviction weight is account-specific and calculated from protocol-recorded entry checkpoints.
- If outcome tokens are transferred directly, the receiver receives base exposure but not the sender's historical conviction bonus.
- If transfer-aware accounting is too large for the first release, restrict direct transfers and route position changes through protocol-mediated swap, enter, or exit flows.

This avoids a flaw where users could buy old conviction from another wallet immediately before settlement.

## Conviction Weight

The first-prize version should implement the full conviction model if possible.

Formula:

```text
convictionWeight = amount * earlyEntryMultiplier * holdingTimeMultiplier * contrarianEntryMultiplier
```

### earlyEntryMultiplier

Earlier entry receives a higher multiplier.

Purpose:

- Rewards early discovery.
- Reduces last-minute copying.

### holdingTimeMultiplier

Longer holding receives a higher multiplier.

Purpose:

- Rewards commitment.
- Makes exit decisions meaningful.

### contrarianEntryMultiplier

Entering the eventually winning side while that side is less popular receives a higher multiplier.

Purpose:

- Rewards informed contrarian positioning.
- Differentiates Conviction from simple majority-following markets.

### Simplified Fallback

If time is constrained, implement:

```text
convictionWeight = amount * earlyEntryMultiplier
```

The frontend and README should still explain the full intended formula, while clearly identifying which multipliers are implemented in the submitted version.

## Shared Collateral Pool

All market participants contribute to one shared collateral pool.

When users enter YES or NO exposure, collateral enters the market system. When users exit before settlement, they receive collateral back after the exit tax. The retained tax remains in the shared pool.

After settlement:

```text
claim = userWinningWeight / totalWinningWeight * distributableCollateral
```

The pool creates a parimutuel-style settlement structure where the winning side shares the market's accumulated collateral.

## Time-Aware Exit Tax

Users can exit before deadline, but exiting has a cost.

Formula:

```text
exitTax = baseTax + timeTax + imbalanceTax
```

### baseTax

Default protocol spread for early exit.

### timeTax

Increases as deadline approaches.

Purpose:

- Discourages last-minute free optionality.
- Makes holding conviction meaningful.

### imbalanceTax

Increases when exiting from an overcrowded outcome side.

Purpose:

- Reduces crowding-driven instability.
- Rewards liquidity staying in the market.

Fallback if time is constrained:

```text
exitTax = baseTax + timeTax
```

Collected exit tax stays in the shared collateral pool and increases final payout for the winning side.

## Probability and Market Analytics

After each swap, the Hook should emit events that allow the frontend to render market state.

Minimum analytics:

- YES supply
- NO supply
- YES probability or supply ratio
- NO probability or supply ratio
- Shared collateral pool size
- Latest exit tax estimate
- Total conviction weight per side

Suggested probability approximation:

```text
yesProbability = yesExposure / (yesExposure + noExposure)
```

The product should label this as market-implied probability or conviction share, not as guaranteed real-world probability.

## Resolver and Oracle Plan

Settlement requires a resolver or oracle.

The hackathon release should include a resolver interface:

```solidity
interface IOutcomeResolver {
    function resolve(bytes32 marketId) external returns (uint8 winningOutcome);
}
```

### ManualResolver

Purpose:

- Controlled demo resolution.
- Simple, reliable controlled demo flow.

Behavior:

- Only authorized resolver can submit outcome.
- Resolution only allowed after deadline.

### MockPriceResolver or PriceResolver

Purpose:

- Demonstrate price-threshold markets such as OKB above target price.

Behavior:

- Market stores target price and deadline.
- Resolver compares observed or mocked price against target.
- Winning outcome is YES if price is above target, otherwise NO.

### Future Optimistic Resolver

Not required for the hackathon release, but important for the roadmap.

Future behavior:

1. Anyone proposes an outcome with a bond.
2. Challenge period opens.
3. If unchallenged, outcome finalizes.
4. If challenged, dispute process determines result.

## Frontend Requirements

The frontend should be simple but complete enough for judges to understand the full lifecycle.

Required screens or sections:

### Market List

- Active markets
- Resolved markets
- Market question
- Deadline
- Current YES/NO conviction split
- Pool size

### Market Detail

- Question
- Collateral token
- Deadline countdown
- YES and NO cards
- Current probability or conviction share
- Pool size
- Total conviction weight
- Recent Hook events

### Enter Flow

- Select YES or NO
- Enter collateral amount
- Preview expected outcome exposure
- Preview conviction multiplier
- Submit swap
- Show transaction hash

### Exit Flow

- Show user position
- Preview exit tax
- Preview returned collateral
- Submit exit transaction
- Show `ConvictionExited` event

### Settlement Flow

- Show market expired state
- Resolver action for demo account
- Show resolved outcome
- Show claimable payout
- Claim button

### Judge Mode

A judge-friendly mode should show:

- Deployed contract addresses
- Current network
- Latest Hook-triggered events
- Demo step checklist
- Links to transaction hashes or explorer pages if available

## Demo Script

Prepare a deterministic demo script that can run the full lifecycle.

Flow:

1. Create an OKB price event market.
2. Seed required pool liquidity or market balances.
3. Alice enters YES early.
4. Bob enters NO later.
5. Alice exits part of her YES position and pays time-aware exit tax.
6. Carol enters YES late and receives a lower conviction multiplier.
7. Deadline passes.
8. A new swap attempt fails because the Hook freezes the market.
9. Resolver submits YES as the winning outcome.
10. Alice and Carol claim.
11. Demo compares their payout per token and shows Alice's early conviction advantage.

This flow demonstrates more than a basic MVP because it shows conviction differentiation between two winning users.

## Agentic Wallet Demo Flow

Prepare a second demo path that shows Conviction can be operated by an AI agent using OKX Onchain OS Agentic Wallet.

Recommended flow:

1. User asks the agent to check their X Layer wallet status and balance.
2. Agent displays the Agentic Wallet address and available collateral.
3. User asks the agent to enter the OKB Conviction market on YES with a small amount.
4. Agent previews the market state, conviction multiplier, and expected transaction.
5. Agentic Wallet signs and broadcasts the contract interaction using secure TEE-based signing.
6. Agent reports the full transaction hash and updated Hook events.
7. After resolution, user asks the agent to claim winnings.
8. Agent checks the resolved market state and executes the claim.
9. Agent summarizes final payout, conviction weight, and transaction history.

This should be framed as a first-prize differentiator:

> Conviction is not only a Hook-native market. It is an agent-operable market where AI can manage event-asset positions through Onchain OS.

## Demo Video Plan

Create a 1-3 minute video.

Recommended structure:

1. **Opening, 10 seconds**
   - "Conviction is a Hook-native event asset protocol on X Layer."

2. **Problem, 15 seconds**
   - "Prediction markets reward being right, but not being early or committed."

3. **Mechanism, 30 seconds**
   - Show YES/NO outcome assets.
   - Show swap triggering Hook events.
   - Show conviction weight and exit tax.

4. **Lifecycle, 45 seconds**
   - Alice enters early.
   - Bob enters later.
   - Alice exits part and pays tax.
   - Deadline freezes trading.
   - Resolver settles.
   - Winner claims.

5. **Why X Layer and Uniswap v4, 20 seconds**
   - Low gas and high throughput enable short-cycle event assets.
   - Hook is the market engine.

6. **Closing, 10 seconds**
   - Show contract addresses and final claim result.

## Social and Submission Plan

Create a dedicated X/Twitter account for Conviction.

Required submission behavior:

- Post during the hackathon.
- Final submission post tags `@XLayerOfficial`, `@Uniswap`, and `@flapdotsh`.

Suggested posts:

1. "Every swap is a belief signal."
2. "Prediction markets reward correctness. Conviction rewards being right, early, and committed."
3. "The Hook is the market engine."
4. "Conviction is live on X Layer mainnet with a Uniswap v4 Hook-triggered settlement lifecycle."

## README Requirements

The repository README should include:

- What Conviction is
- Why it needs Uniswap v4 Hooks
- Why it is built on X Layer
- Architecture diagram or module list
- Hook lifecycle explanation
- How to run tests
- How to deploy locally
- How to deploy to X Layer mainnet
- How to run the demo script
- Contract addresses after deployment
- Known limitations
- Roadmap

## Deployment Output Table

Final submission should include this table after deployment.

| Component | Address field | Network |
| --- | --- | --- |
| Conviction Hook | Filled after deployment | X Layer mainnet |
| Market Factory | Filled after deployment | X Layer mainnet |
| Market Contract | Filled after deployment | X Layer mainnet |
| YES Token | Filled after deployment | X Layer mainnet |
| NO Token | Filled after deployment | X Layer mainnet |
| Resolver | Filled after deployment | X Layer mainnet |
| Uniswap v4 Pool | Filled after deployment | X Layer mainnet |
| Frontend | Filled after deployment | Public demo URL or local demo |
| Demo Video | Filled after recording | Public video URL or submitted file |

## Hook Responsibilities

### beforeInitialize or afterInitialize

Responsibilities:

- Validate that the pool belongs to a registered market.
- Bind pool identity to market identity.
- Reject invalid collateral or outcome token pairs.

### beforeSwap

Responsibilities:

- Check whether the market is active.
- Reject swaps after the deadline.
- Reject swaps after resolution.
- Validate swap direction and market side.
- Calculate dynamic fee or exit tax preview.
- Enforce market-specific trading rules.

### afterSwap

Responsibilities:

- Update outcome exposure.
- Update market-side supply.
- Update shared collateral accounting.
- Record user entry checkpoint.
- Update implied probability or conviction split.
- Emit market state events.

### afterAddLiquidity

Responsibilities:

- Validate liquidity is added only to registered market pools.
- Prevent invalid liquidity from bypassing market constraints.
- Emit liquidity-related events if useful for frontend analytics.

### settle and claim

Responsibilities:

- Accept final outcome from resolver.
- Freeze market state.
- Compute total winning weight.
- Allow winning users to claim collateral.
- Prevent double claims.

## Key Events

Recommended events:

```solidity
event MarketCreated(bytes32 indexed marketId, string question, uint256 deadline);
event PoolBound(bytes32 indexed marketId, bytes32 indexed poolId);
event ConvictionEntered(address indexed user, bytes32 indexed marketId, uint8 outcome, uint256 amount, uint256 weight);
event ConvictionExited(address indexed user, bytes32 indexed marketId, uint8 outcome, uint256 amount, uint256 tax);
event ProbabilityUpdated(bytes32 indexed marketId, uint256 yesProbability, uint256 noProbability);
event ExitTaxUpdated(bytes32 indexed marketId, uint256 yesExitTax, uint256 noExitTax);
event MarketExpired(bytes32 indexed marketId);
event MarketResolved(bytes32 indexed marketId, uint8 winningOutcome);
event Claimed(address indexed user, bytes32 indexed marketId, uint256 amount, uint256 weight);
```

## Testing Plan

### Unit Tests

Required tests:

- Market creation stores correct metadata.
- Hook rejects unregistered pools.
- Hook allows swaps before deadline.
- Hook rejects swaps after deadline.
- Hook rejects swaps after resolution.
- Conviction weight increases for earlier entry.
- Exit tax increases near deadline.
- Resolver cannot settle before deadline.
- Resolver can settle after deadline.
- Losing users cannot claim.
- Winning users cannot double claim.
- Total claims never exceed distributable collateral.

### Integration Tests

Required tests:

- Deploy Pool and Hook locally.
- Execute real swap through PoolManager or router.
- Confirm Hook events are emitted.
- Run full lifecycle: create, enter, exit, expire, resolve, claim.

### Invariant Tests

Recommended invariants:

- Collateral conservation.
- No claims before resolution.
- No trading after expiration.
- No double claims.
- Total winning payout is bounded by collateral pool.
- Conviction bonus cannot be transferred by simple token transfer unless explicitly supported.

### Mainnet Verification

Required before submission:

- Validate contracts locally and on a fork of X Layer mainnet where possible.
- Deploy contracts to X Layer mainnet.
- Create a capped collateral demo market.
- Run demo script against X Layer mainnet with small amounts.
- Confirm transaction hashes and emitted events.
- Capture frontend or script output for demo video.
- Include mainnet addresses as the primary proof point.

## Security and Risk Considerations

### Resolver Trust

Manual resolution is centralized. The submission should clearly state that the MVP uses a trusted resolver and that the production roadmap includes optimistic or oracle-based resolution.

### Conviction Farming

Users may try to game conviction multipliers by entering early with tiny amounts or splitting wallets.

Mitigations:

- Cap multipliers.
- Use minimum meaningful position size for bonus eligibility.
- Make bonuses smooth rather than cliff-based.
- Treat advanced sybil resistance as future work.

### Transfer Abuse

If outcome tokens are transferable, users may try to transfer old positions to new wallets.

Mitigation:

- Keep conviction weight account-specific.
- Reset or recompute conviction on transfer.
- Restrict direct transfers in the first release if necessary.

### Oracle Manipulation

Price-based markets depend on price sources.

Mitigation:

- Use mock or manual resolver only for demo.
- Avoid claiming production-grade oracle security.
- Use short, clearly experimental demo markets.

### Hook Permission and Deployment Risk

Uniswap v4 Hooks require permission bits in the deployed Hook address.

Mitigation:

- Use deterministic CREATE2 deployment.
- Add tests that verify the deployed Hook address has the expected permissions.
- Deploy to local chain and forked X Layer mainnet before live mainnet deployment.

## Scope Boundaries

The first-prize release should be ambitious but still shippable.

The release includes:

- Binary YES/NO markets.
- Real Hook-triggered swap lifecycle.
- Shared collateral accounting.
- Conviction-weighted settlement.
- Time-aware exit tax.
- Resolver-based settlement.
- Frontend and demo script.
- X Layer mainnet deployment.
- Optional mainnet deployment.

The release does not include:

- Full central limit order book.
- Production-grade optimistic dispute resolution.
- Full governance.
- Leveraged positions.
- Complex derivative markets.
- Guaranteed production oracle security.

These exclusions should be presented as deliberate scope choices, not missing features.

## Judging Narrative

Use this framing in the submission:

> Conviction is not a prediction market bolted onto Uniswap. It is a Hook-native event asset protocol. The Hook is the market engine: it turns swaps into belief signals, controls market lifecycle, prices exits, records conviction, freezes expired markets, and distributes the shared collateral pool to users who were right, early, and committed.

## Success Criteria

The project is successful for the hackathon if judges can verify that:

1. A Uniswap v4 Pool and custom Hook are deployed on X Layer.
2. A real swap triggers Conviction Hook logic.
3. Outcome exposure changes through the swap path.
4. The Hook freezes trading after the deadline.
5. The resolver sets a winning outcome.
6. Winning users can claim from the collateral pool.
7. Conviction weight visibly affects payout or market state.
8. Exit tax visibly affects early exit behavior.
9. A frontend shows the full lifecycle.
10. A demo script can reproduce the lifecycle.
11. Agentic Wallet can operate at least one Conviction interaction on X Layer.
12. The demo shows AI-assisted balance check, transaction execution, transaction tracking, and Hook event summary.
13. A 1-3 minute video explains the mechanism clearly.
14. Submission materials include contract addresses, README, Agentic Wallet demo notes, and social post.

## Final Award Strategy

The minimum acceptable submission is not the target.

The target is:

- P0 compliance fully complete.
- P1 product core fully complete.
- Most P2 polish complete.
- P3 stretch features attempted only after local, fork, and live mainnet demo reliability is proven.

This gives Conviction a credible first-prize profile: innovative Hook-native mechanics, visible market value on X Layer, complete demo lifecycle, and enough product polish for judges to understand the idea quickly.
