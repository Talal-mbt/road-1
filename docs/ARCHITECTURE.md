# ROAD — Architecture

## Current release

ROAD is a static, phone-first Progressive Web App. There is no backend service, broker bridge, cloud terminal or database.

- `index.html`: Arabic/English responsive dashboard, Gold module, Solana market discovery, local MT5 profile metadata and paper-trading UI.
- `js/paper-engine.js`: local Solana paper-account simulation.
- `js/gold-engine.js`: XAU/USD reference-data validation, EMA/RSI/momentum analysis and local Gold paper-trade accounting.
- `manifest.webmanifest`: Android-installable PWA identity for ROAD.
- `service-worker.js`: same-origin app-shell cache; external market data is never cached.
- `assets/app-icon.svg`: ROAD application icon.
- `tests/*.test.cjs`: unit tests for both paper engines.
- `scripts/smoke-check.cjs`: static app structure and safety-boundary checks.

## Application identity and local data

The product-facing name is ROAD. The repository slug is `road-1`. On first load after the brand refresh, the app migrates known values from its previous internal localStorage namespace to the current `road.*` equivalents, removing the prior key only after a successful copy. This preserves existing virtual balances, market snapshots, language preference and saved MT5 profile metadata on the same browser origin.

## Gold data flow

1. The user activates the Gold monitoring toggle.
2. While the PWA is visible and online, the page requests XAUS spot and intraday reference data.
3. The engine validates explicit fresh-state metadata, quote timestamps, a sufficient sample count and the age of the latest sample.
4. EMA 20, EMA 50, RSI 14, short-term momentum and recent range are calculated from the provider's two-minute sampled series.
5. BUY BIAS / SELL BIAS / WAIT is a rule-based directional alignment, not a probability forecast.
6. Local paper-trade actions use the latest indicative reference quote and local assumptions for costs, stop and target.
7. Positions and history are stored in browser localStorage.

XAUS data is not a broker quote, not MT5 Bid/Ask and not a tick-level execution feed.

## Offline and PWA behavior

The app shell remains available from the service-worker cache when offline. The app reports offline status and stops data refreshes when the browser reports loss of connectivity. On reconnect, eligible modules resume fetching current data.

The service worker caches same-origin app files only. It does not cache external market prices or imply that those prices are current while offline.

## MT5 profiles and future bridge

The current MT5 screen stores only account type, login and server metadata in localStorage. It does not request or retain passwords and does not create a broker session.

A future MT5 integration requires a separately deployed backend and a verified broker/cloud-terminal bridge. Credentials must be entered through a trusted provider-hosted flow or handled through an approved secure secret store, never placed in the PWA, browser storage, Git history or logs.

## Paper-trading risk semantics

- Solana paper positions use the isolated local paper engine.
- Gold paper positions use a separate virtual account.
- The Gold notional allocation, position cap and local loss locks apply only to the simulator.
- Local browser state is editable and is not an authoritative or tamper-proof financial ledger.
- Simulated stops are checked against sampled reference prices, not broker-side orders.

## Production direction

A future production architecture should isolate frontend, identity, account ownership, broker connector, execution supervisor, risk service, durable database and audit trail. All trading permissions and risk policies must be enforced server-side. Any future live execution must be separately authorized, idempotent, reconciled against broker state and independently reviewed.
