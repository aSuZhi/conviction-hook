# Conviction Agentic Wallet Skill

Operate Conviction markets on X Layer with natural-language agent instructions.

This skill helps an AI agent inspect Conviction markets, prepare exact wallet actions, route entries and exits through the Conviction protocol path, settle demo sessions, claim winnings, and import transaction evidence back into the DApp. It is designed for the Conviction hackathon demo and for judges who want to test the full on-chain user journey from an Agentic Wallet.

## Install

```bash
npx skills add aSuZhi/conviction-agentic-wallet
```

For local judging from the Conviction repo on Windows:

```powershell
xcopy ".agents\skills\conviction-agentic-wallet" "%USERPROFILE%\.agents\skills\conviction-agentic-wallet" /E /I /Y
```

For local judging on macOS or Linux:

```bash
mkdir -p ~/.agents/skills
cp -R .agents/skills/conviction-agentic-wallet ~/.agents/skills/
```

## What It Supports

- Discover active Conviction markets on X Layer.
- Start a wallet-scoped demo market session.
- Claim capped demo cUSDC and pool-token assets.
- Build buy and sell transaction payloads through `ConvictionRouter`.
- Settle the caller's demo market as YES or NO.
- Claim settlement-weighted winnings.
- Inspect transaction receipts for Router, PoolManager, Hook, and Market evidence.
- Import Agentic Wallet transaction proof into the DApp evidence surface.

## Example Prompts

```text
Open a Conviction demo session on X Layer, claim demo funds, then buy YES with 0.5 cUSDC.
```

```text
Settle my current Conviction demo market as YES, inspect the receipt, then claim winnings if claimable is above zero.
```

```text
Inspect this X Layer tx and summarize whether PoolManager, ConvictionHook, and ConvictionMarket events were observed.
```

## Helper CLI

The helper builds safe transaction payloads and inspects receipts. It never signs, broadcasts, or stores private keys.

```bash
node scripts/conviction-agent.mjs config
node scripts/conviction-agent.mjs build enter --from 0x... --market 0x... --outcome yes --amount 0.5
node scripts/conviction-agent.mjs inspect-tx --hash 0x... --market 0x...
```

## Safety Model

- The skill prepares actions; the connected wallet signs and broadcasts.
- Exact approvals are preferred. Unlimited approvals are not required.
- Entry and exit actions must route through `ConvictionRouter`.
- The helper does not custody funds, sign transactions, or manage seed phrases.
- Demo sessions are wallet-scoped so one user's settlement does not block another user's experience.

## X Layer Deployment

The deployment addresses used by the skill are stored in [`addresses.json`](addresses.json). The default network is X Layer mainnet.

Key contracts:

- `DemoJourneyController`
- `ConvictionRouter`
- `ConvictionHook`
- `ConvictionMarketManager`
- `ConvictionMarket`
- Demo cUSDC collateral token

## Repository

GitHub: https://github.com/aSuZhi/conviction-agentic-wallet
