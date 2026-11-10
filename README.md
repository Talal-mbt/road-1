# ROAD TO CASH — Solana Market Intelligence Terminal

A responsive, signal-first research dashboard for Solana token discovery, explainable market context, candidate review, and **local paper-only portfolio simulation**.

## Safety boundary

- No wallet adapter, private-key storage, seed phrase handling, signing, or live transaction route exists.
- The executor is a local paper simulator only. UI buttons cannot place real orders.
- Synthetic starter assets and their scores are illustrative fixtures, not real tokens or backtest results.
- Optional DexScreener integration retrieves public pair metrics; those metrics do not prove token safety, ownership quality, or sellability.
- Unknown security facts remain **UNKNOWN** and must never be interpreted as safe.
- Nothing in this repository is investment advice or a promise of returns.

## Current capabilities

- Responsive command dashboard with clearly marked sample/public market data.
- SCOUT discovery from synthetic fixtures or optional public DexScreener pair snapshots.
- FILTER surface that treats contract/holder/sellability evidence as unverified.
- ANALYST factor placeholders; demo scores are not a trained AI model or win probability.
- EXECUTOR paper buy/close with modeled entry/exit slippage and fees.
- Separate paper portfolio engine in `js/paper-engine.js`.
- Configurable-by-code paper limits: 1% of virtual equity as position **notional** per entry, 3 concurrent positions, 2% daily loss circuit breaker, and 5% high-water drawdown circuit breaker.
- Manual entry pause, sticky risk lock, session event log, and best-effort browser-local persistence.
- Public snapshots are marked stale after five minutes and new paper entries are blocked until refreshed.
- Node unit tests and static application smoke checks run through GitHub Actions.

## Important interpretation of the paper controls

The 1% setting is a simulated notional allocation, **not** a 1% maximum-loss guarantee. This MVP has no stop-loss order model, no real order-book fills, no sandwich/MEV simulation, no authoritative risk service, and no audited ledger. Circuit breakers block new paper entries; they do not automatically liquidate existing positions. Browser local storage is editable and can be cleared by the user, so it is not a durable or tamper-proof accounting system.

## Run locally

Requires Node.js 22 for tests and any modern browser for the app.

Start a local static server from the repository root:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Run checks:

```bash
node --test tests/paper-engine.test.cjs
node scripts/smoke-check.cjs
```

DexScreener fetch requires internet access and may be limited by provider availability, rate limits, or browser CORS policy. A failed request keeps the last snapshot and records an error.

## Deploy to GitHub Pages

1. Open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push to `main` after review, or run the Pages workflow manually.
3. The workflow packages `index.html` and the required `js/` directory.
4. Find the deployment URL in the workflow summary and Settings → Pages.

The quality workflow runs on branch pushes and pull requests. Pages deployment remains separate from test execution.

## Production roadmap — not implemented

1. A backend API with authentication/authorization and server-side policy enforcement.
2. Durable relational storage and append-only audit events.
3. Independent on-chain providers for mint/freeze authority, token extensions, holder concentration, pool ownership/lock evidence, and sellability simulation.
4. Provider adapters with timestamps, rate limits, retry/backoff, circuit breakers, stale-data gates, and quality metrics.
5. A replayable market-data store and deterministic historical evaluation.
6. A formal threat model, dependency/security review, and independent penetration test.
7. Any future live signing/execution module must be a separate service, separately authorized, disabled by default, and protected by independent policy approval.

## Repository

Private repository: https://github.com/Talal-mbt/road-to-cash
