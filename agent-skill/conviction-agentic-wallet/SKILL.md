---
name: conviction-agentic-wallet
description: Use when a user wants an AI agent to operate Conviction markets on X Layer with OKX Agentic Wallet, including demo sessions, claiming demo funds, buying or selling, settling, claiming winnings, or producing Hook and PoolManager evidence.
---

# Conviction Agentic Wallet

## Overview

Operate Conviction as an agent-native X Layer DApp. Entry and exit must use the same Router-facing path as the browser DApp:

```text
Agentic Wallet -> ConvictionRouter -> PoolManager.swap -> ConvictionHook -> ConvictionMarket
```

Never call `ConvictionMarket.enter` or `ConvictionMarket.exit` directly. They are Hook-only by design.

## When to Use

Use this skill for natural-language tasks such as:

- Start my Conviction demo session and buy YES with 0.5 cUSDC.
- Claim demo funds, enter NO, settle my market, then claim winnings.
- Inspect this transaction and tell me whether PoolManager, Hook, and Market events were observed.
- Show my active Conviction market and position on X Layer.

Do not use this skill for unrelated token swaps, oracle production security claims, or private-key based automation.

## Safety Rules

- X Layer mainnet only, chain id `196`.
- Use exact approvals only. Never request unlimited approval.
- Keep demo amounts capped and human-readable.
- If the wallet asks for confirmation, show the confirmation details and wait for explicit approval.
- Never ask for or reveal private keys, mnemonics, API keys, RPC secrets, or raw secret material.
- Do not use direct market entry or exit calls. Use `ConvictionRouter`.
- Claiming winnings may call `ConvictionMarket.claim(address)` directly because claim is settlement accounting, not Hook entry or exit.

## Helper CLI

The helper only builds calldata or inspects receipts. It does not sign or broadcast.

```powershell
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs config
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs build start-session --from 0x...
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs build claim-demo --from 0x...
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs build enter --from 0x... --market 0x... --outcome yes --amount 0.5
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs build settle --from 0x... --outcome yes --evidence demo://agent-yes
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs build claim-winnings --from 0x... --market 0x... --account 0x...
node .agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs inspect-tx --hash 0x... --market 0x...
```

Pass the printed transaction object to the available Agentic Wallet transaction tool. Preserve `from`, `to`, and `data`.

## Standard Flow

1. Confirm wallet address and X Layer network.
2. Read deployment config with `config`.
3. For `/demo`, build and submit `start-session` if the wallet has no active session.
4. Build and submit `claim-demo` if the wallet needs demo cUSDC and pool tokens.
5. Build exact ERC20 approval for the collateral or pool token only if allowance is insufficient.
6. Build and submit `enter` or `exit` through `ConvictionRouter`.
7. After a position exists, build and submit `settle`.
8. If `claimable(address) > 0`, build and submit `claim-winnings`.
9. Inspect every tx and summarize PoolManager, Hook, Market event, market address, and explorer link.

## Output Format

Return concise evidence:

```text
Network: X Layer mainnet
Wallet: 0x...
Market: 0x...
Action: enter YES 0.5 cUSDC
Tx: 0x...
Route proof: PoolManager observed, Hook observed, Market event observed
Explorer: https://www.oklink.com/xlayer/tx/0x...
```

## Common Errors

| Symptom | Meaning | Fix |
| --- | --- | --- |
| `-32602` | Invalid wallet transaction params | Include `from`, `to`, and `data` exactly. |
| `DemoSessionStillActive` | Wallet already has an active market | Use the current `demoMarketOf(wallet)` or settle it first. |
| `ClaimCoolingDown` | Demo funds were claimed in the last 24 hours | Continue with existing funds or wait. |
| `NoClaim` | Wallet has no winning weight | Check winning side and `claimable(address)`. |
| Missing Hook event | Not Router-facing or receipt not loaded | Re-check tx path and inspect receipt. |
