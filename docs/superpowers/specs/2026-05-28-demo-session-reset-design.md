# Demo Session Reset Design

## Goal

Make the `/demo` onboarding flow reusable for every judge and user. A completed demo must not block the next user, and a settled on-chain market must never be mutated back into an unsettled state.

## Product Behavior

- The demo page uses a wallet-scoped session market instead of one shared public market.
- When a wallet connects, the app reads the user's current demo market from the Demo Journey Controller.
- If the user has no session market, or their session market is resolved, voided, or expired, the page shows a primary action to start a new demo session.
- Starting a session sends a real X Layer transaction that creates and registers a fresh `ConvictionMarket` for that wallet.
- Claiming demo assets remains limited to once per wallet per 24 hours.
- Trading, settlement, and claiming are scoped to the connected wallet's active session market.
- After settlement, the page shows the result and offers "Start new round" instead of trying to reset the old market.

## Contract Design

Deploy a new Demo Journey Controller version that keeps the existing core protocol contracts:

- `ConvictionHook`
- `ConvictionRouter`
- `ConvictionMarketFactory`
- `ConvictionMarketManager`
- `DemoCollateral`
- `DemoPoolBootstrapper`
- `ManualResolver`

The new controller adds wallet-scoped session storage:

- `mapping(address user => address market) demoMarketOf`
- `mapping(address user => uint256 nonce) demoNonceOf`
- `startDemoSession()` creates and registers a new market for `msg.sender`
- `settleDemoMarket(outcome, evidenceURI)` settles `demoMarketOf[msg.sender]`
- `claimDemoTokens()` keeps the existing 24 hour cooldown

The old global `demoMarket()` can remain as a compatibility fallback, but the frontend should prefer `demoMarketOf(account)`.

## Frontend Design

The `/demo` page becomes "My demo session":

- Connected wallet reads `demoMarketOf(account)`.
- If the market is missing or inactive, the market card is replaced with a start-session panel.
- The market detail button points to the user's session market.
- The trading panel is hidden or disabled until the session market exists and is bettable.
- Settlement stays locked until the user has a YES or NO position.
- After settlement, the page keeps the settled result visible and enables "Start new round".

The route `/judge` remains an alias for `/demo`.

## Data Flow

1. User connects wallet.
2. App reads claim cooldown and `demoMarketOf(account)`.
3. User claims demo funds if eligible.
4. User starts a session if no active market exists.
5. User trades through `ConvictionRouter -> PoolManager.swap -> ConvictionHook -> ConvictionMarket`.
6. User settles their session through `DemoJourneyController -> ConvictionMarketManager -> ConvictionMarket`.
7. User claims if their winning side has claimable collateral.
8. User may start another session without affecting other wallets.

## Error Handling

- If wallet is missing, prompt connect.
- If the connected wallet is on the wrong network, request X Layer.
- If the active session is resolved, expired, or voided, show "Start new round".
- If the user tries to settle before trading, show "Buy YES or NO before triggering settlement."
- If claim is cooling down, show the remaining cooldown and leave trading available if the user already has funds.

## Testing

- Unit test session-gating helpers: missing market, inactive market, active market.
- Contract tests for `startDemoSession`, per-user market isolation, and settling only the caller's session market.
- Frontend wallet-flow test verifies start session, trade gate, settlement gate, and post-settlement new-round CTA.
- Build and browser verification must pass after the deployment config is updated.

