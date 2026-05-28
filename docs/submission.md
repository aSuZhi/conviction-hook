# Conviction Submission Package

## Award Narrative

Conviction is not a prediction market bolted onto Uniswap. It is a Hook-native event asset protocol. The Hook is the market engine: it turns swaps into belief signals, controls market lifecycle, prices exits, records conviction, freezes expired markets, and distributes the shared collateral pool to users who were right, early, and committed.

## Proof Table

| Component | Address or Evidence |
| --- | --- |
| ConvictionHook | See `docs/deployment-addresses.md` |
| ConvictionRouter | See `docs/deployment-addresses.md` |
| ConvictionMarketFactory | See `docs/deployment-addresses.md` |
| ConvictionMarketManager | See `docs/deployment-addresses.md` |
| ManualResolver or PriceResolver | See `docs/deployment-addresses.md` |
| Demo Market | See `docs/deployment-addresses.md` |
| YES Token | See `docs/deployment-addresses.md` |
| NO Token | See `docs/deployment-addresses.md` |
| Uniswap v4 Pool/PoolKey | See `docs/deployment-addresses.md` |
| Frontend URL or local demo URL | Fill during final submission |
| Demo video URL or file | Fill during final submission |
| Final settlement and claim evidence | See `docs/deployment-addresses.md` final lifecycle rows |
| Agentic Wallet demo evidence | Not submitted in this evidence package unless a transaction hash is imported through `/agent`; see `docs/agentic-wallet-demo.md` |

See `docs/final-evidence-status.md` for the current evidence gate, mainnet proof, and Agentic Wallet caveat.

## Demo Video Outline

```text
0:00 Problem: prediction markets reward correctness only
0:20 Thesis: Conviction rewards being right, early, and committed
0:40 Hook path: swap triggers PoolManager and ConvictionHook
1:10 Product demo: market page, trade ticket, conviction engine
1:45 Lifecycle: enter, exit, freeze, resolve, claim
2:20 Agentic Wallet: AI-assisted operation on X Layer
2:45 Evidence: X Layer addresses, transaction hashes, Hook events
```

## Social Post Draft

```text
Every swap is a belief signal.

Conviction is live as a Uniswap v4 Hook-native event asset protocol on X Layer: users trade YES/NO outcome assets, while the Hook records conviction, prices exits, freezes markets, and powers settlement for users who were right, early, and committed.

Built for the OKX Web3 Developer Challenge with X Layer, Uniswap v4 Hooks, and Agentic Wallet execution.
```

## Final Readiness Gate

- Solidity tests pass.
- Frontend unit tests pass.
- Frontend production build passes.
- `/markets` shows bettable markets by default.
- `/markets/:address` shows Conviction Engine, Hook path, exit tax, settlement math, and trade ticket.
- `/studio` is route-separated from user trading.
- `/judge` shows addresses, lifecycle checklist, and evidence.
- `/agent` shows Agentic Wallet task and imported evidence path.
- No fake PnL, fake order book, or fake live data is displayed.

Evidence caveat:

- Agentic Wallet execution evidence is not submitted in this package unless a later `/agent` import adds a real transaction hash.
