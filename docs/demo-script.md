# Conviction Demo Script

## 1. Setup shot

Show the product landing dashboard on X Layer mainnet.

Say:

> Conviction is a Uniswap v4 Hook-native event asset protocol. Prediction markets usually reward correctness. Conviction rewards being right, early, and committed.

Point to:

- X Layer mainnet network badge.
- Deployed Hook, Router, Factory, and Market addresses.
- Hook status panel.
- YES/NO conviction split.

## 2. Hook-native entry

Open the market trading panel and enter a small YES amount.

Say:

> This is not a direct mint. The entry goes through ConvictionRouter, calls Uniswap v4 PoolManager.swap, and the Hook records conviction accounting in afterSwap.

Evidence to capture:

- Transaction hash.
- `HookSwapObserved` event.
- `ConvictionEntered` event.
- Updated `ProbabilityUpdated` event.

## 3. Conviction mechanics

Show the outcome curve and trade preview.

Say:

> The weight is amount times early-entry, holding-time, and contrarian-entry multipliers. Exiting before resolution pays a time-aware and imbalance-aware exit tax back into the shared collateral pool.

Point to:

- Conviction multiplier.
- Exit tax.
- Shared pool.
- YES/NO split.

## 4. Exit path

Execute a small partial exit.

Say:

> Exit also uses the swap-facing Hook path. The Hook checks the market is active and unresolved, then calls market exit accounting after the swap is observed.

Evidence to capture:

- Transaction hash.
- `HookSwapObserved` event.
- `ConvictionExited` event.
- Reduced outcome token balance.
- Tax retained in pool.

## 5. Deadline freeze and resolution

Advance or wait until deadline for the demo market, then resolve with `ManualResolver`.

Say:

> Settlement is intentionally not a swap. Entry and exit are Hook-native; resolution and claim rely on the state created by Hook-triggered trading.

Evidence to capture:

- New entries/exits rejected after deadline.
- `OutcomeSet` from resolver.
- `MarketResolvedEvent` from market.

## 6. Claim

Claim the winning side payout.

Say:

> Payout is weighted by conviction, not just raw amount. Earlier and more committed correct positions receive a larger share of the resolved collateral pool.

Evidence to capture:

- `Claimed` event.
- Claimable payout before claim.
- Wallet balance change.

## 7. Agentic Wallet highlight

Show the Agentic Wallet panel and run the agent flow.

Say:

> Agentic Wallet lets an AI agent check balance, prepare the same ConvictionRouter transaction path, sign securely, track the X Layer transaction, and summarize Hook events. It does not bypass the Hook.

Evidence to capture:

- Wallet status or balance read.
- Router contract-call preparation.
- Transaction hash.
- Hook event summary.

## 8. Closing line

Say:

> Conviction turns Uniswap v4 Hooks from passive swap callbacks into the market engine for event assets on X Layer.
