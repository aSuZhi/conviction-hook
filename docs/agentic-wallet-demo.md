# Agentic Wallet Demo

Agentic Wallet is a first-prize differentiator, not a convenience wallet. It must operate the same Router-facing path as the browser DApp and must not bypass Hook accounting.

## Required Flow

1. Check Agentic Wallet status.
2. Show the X Layer address.
3. Show X Layer balance.
4. Read active Conviction market state.
5. Preview trade amount, conviction multiplier, and exit tax.
6. Execute a Router-facing enter transaction.
7. Track the transaction hash.
8. Read Hook event evidence.
9. Claim or exit after market state changes.
10. Summarize final payout and evidence.

## Flagship Task

```text
Show active Conviction markets on X Layer, enter YES on the OKB market with 5 cUSDC, exit half before deadline if the exit tax is below 3%, and claim if YES wins.
```

## Accepted Evidence Fields

- Agentic Wallet address.
- Command or natural-language task.
- Network.
- Market address.
- Transaction hash.
- Before state.
- After state.
- Hook event summary.
- Explorer link.

## Current Submission Status

The frontend `/agent` route is now the Conviction Agent Skill landing and proof surface. The installable repo-local skill lives at:

```text
.agents/skills/conviction-agentic-wallet
```

The skill includes a helper CLI:

```powershell
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs config
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs build enter --from 0x... --market 0x... --outcome yes --amount 0.5
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs inspect-tx --hash 0x... --market 0x...
```

Do not claim Agentic Wallet execution as final mainnet evidence until the operator imports at least one X Layer transaction hash produced by Agentic Wallet through the `ConvictionRouter` enter or exit path.

## GitHub publishing

The skill folder is publish-ready. From `.agents/skills/conviction-agentic-wallet`:

```powershell
git init
git add .
git commit -m "Publish Conviction Agentic Wallet skill"
git branch -M main
gh auth login
gh repo create conviction-agentic-wallet --public --source . --remote origin --push
```

After publishing, the user-facing install command should be:

```powershell
npx skills add aSuZhi/conviction-agentic-wallet
```

## Safety Gate

Agentic Wallet enter and exit interactions must call the same `ConvictionRouter` path used by the frontend. Agentic Wallet may call `claim` directly because claim is settlement. It must not call `ConvictionMarket.enter` or `ConvictionMarket.exit` directly.
