# Conviction Agent Skill Design

## Goal

Turn the current `/agent` page from a manual evidence import form into a product-grade Agent Skill landing and proof surface. The real execution capability lives in an installable skill package that lets an AI agent operate Conviction on X Layer through OKX Agentic Wallet style flows.

## Product Shape

The final product has two layers:

1. **Conviction Agent Skill**
   - A repo-packaged skill at `.agents/skills/conviction-agentic-wallet`.
   - Teaches an agent how to discover markets, start a wallet-scoped demo session, claim demo funds, submit exact approvals, enter or exit via `ConvictionRouter`, settle the caller's demo market, claim winnings, and inspect transaction evidence.
   - Includes a helper CLI that builds safe calldata and inspects receipt evidence without exposing private keys or bypassing wallet confirmation.

2. **Agent page**
   - `/agent` becomes the visible product page for judges and users.
   - It explains what the skill can do, how to install it locally during judging, how to invoke it with natural language, which contract addresses it targets, and how imported Agentic Wallet evidence maps back into the DApp.
   - The old manual import form stays, but as a lower-priority "Import an Agent tx" section, not the primary experience.

## Agent Skill Requirements

- Must say that entry and exit always route through `ConvictionRouter`, `PoolManager.swap`, `ConvictionHook`, and `ConvictionMarket`.
- Must forbid direct calls to `ConvictionMarket.enter` and `ConvictionMarket.exit`.
- Must use X Layer mainnet, chain id `196`.
- Must use exact approvals only.
- Must keep demo amounts capped and ask for confirmation before broadcasting when the wallet tool asks for it.
- Must never expose or request private keys, mnemonics, API keys, or raw secret material.
- Must support these natural language tasks:
  - "Open a Conviction demo session and buy YES with 0.5 cUSDC."
  - "Settle my current demo market as YES and claim winnings."
  - "Inspect this tx and tell me whether PoolManager, Hook, and Market events were observed."
  - "Show active Conviction markets and my position."
- Must produce an evidence summary containing transaction hash, market, route proof, and claim or position result.

## Helper CLI Requirements

The skill includes `scripts/conviction-agent.mjs` with these commands:

- `config`: print X Layer deployment config.
- `build start-session`: output an `eth_sendTransaction` payload to call `DemoJourneyController.startDemoSession()`.
- `build claim-demo`: output a payload to call `DemoJourneyController.claimDemoTokens()`.
- `build settle --outcome yes|no --evidence <uri>`: output a payload to settle the caller's demo market.
- `build claim-winnings --market <address> --account <address>`: output a payload to call `ConvictionMarket.claim(address)`.
- `build approve-collateral --spender <address> --amount <decimal>`: output an exact ERC20 approval payload.
- `build enter|exit --market <address> --outcome yes|no --amount <decimal>`: output a Router-facing payload.
- `inspect-tx --hash <tx>`: read a receipt and report PoolManager, Hook, and Market event presence.

The CLI only builds or inspects. It does not sign or broadcast.

## Agent Page Requirements

- Replace the current "AI-native execution proof" page with "Conviction Agent Skill".
- Show capability cards similar in spirit to Four.meme's Agent Skill page, but tailored to Conviction:
  - Discover markets
  - Start demo session
  - Claim demo assets
  - Buy or sell via Router
  - Settle demo market
  - Claim winnings
  - Inspect Hook path proof
  - Import evidence
- Show installation steps:
  - Local judging install from `.agents/skills/conviction-agentic-wallet`.
  - Future GitHub install command placeholder with explicit note to replace with published repo URL.
- Show copyable natural-language prompts.
- Show live deployment config from the app's current config.
- Keep the evidence import form and imported evidence count.
- Use the app's restrained dark product UI vocabulary, with no decorative landing-page fluff.

## Verification

- `npm --prefix app run test:unit`
- `npm --prefix app run build`
- `npm --prefix app run test:wallet`
- `node scripts/test-conviction-agent-skill.mjs`
- Browser route verification with `/agent` expecting "Conviction Agent Skill".

## Scope Boundaries

- This work does not publish a package to npm or GitHub.
- This work does not broadcast Agentic Wallet transactions automatically.
- This work does not replace `/demo`; `/demo` remains the hands-on wallet flow.
