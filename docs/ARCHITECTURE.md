# Architecture

## Current release

Static, phone-first PWA. No backend, account service, broker bridge or database.

- `index.html`: responsive dashboard, Solana screens, Gold monitor, local paper trades and UI state.
- `js/paper-engine.js`: Solana paper-account simulation.
- `js/gold-engine.js`: XAU/USD reference-series validation, EMA/RSI/momentum analysis and Gold paper-trade accounting.
- `manifest.webmanifest`, `service-worker.js`, `assets/app-icon.svg`: installable app shell and offline static asset cache.
- `tests/*.test.cjs`: unit tests for both paper engines.
- `scripts/smoke-check.cjs`: static UI/security boundary checks.

## Gold data flow

1. User presses the Gold monitor toggle.
2. While the PWA is visible, the page requests `https://xaus.com/api/v1/spot?compact=1` and `/api/v1/intraday?symbol=xau&hours=24` once per minute.
3. The engine requires fresh-state metadata, a valid quote timestamp, at least 60 samples, and a recent final sample. It rejects stale/unavailable feeds.
4. EMA 20, EMA 50, RSI 14, 20-sample range and short-term momentum are calculated from the provider's 2-minute sampled reference series.
5. BUY BIAS / SELL BIAS / WAIT is a rule-based direction alignment only. It is not a prediction probability.
6. Manual paper-trade actions use the latest indicative spot reference and local fee/slippage assumptions. Simulated stops/targets are checked only at fetched snapshots.
7. Position state and history are saved to browser local storage on the phone.

## Local phone behavior

The PWA service worker caches only same-origin app-shell assets. It never caches external market data. The page pauses polling when it becomes hidden and refreshes after it returns to the foreground. Android can suspend a background tab/PWA; this architecture does not promise continuous execution with the screen off or app closed.

## Risk and execution boundary

- There is no xChief connection, MT5 integration, MT5 EA runtime or broker order route.
- Gold paper notional is 1% of virtual equity, up to three positions.
- Gold simulation applies assumed entry/exit fees, a fixed illustrative stop distance and target distance, and local 2% daily-loss / 5% drawdown locks.
- These are simulator rules, not a guaranteed maximum-loss limit in live trading.
- The data feed is indicative spot, not broker Bid/Ask, and 2-minute samples cannot reproduce tick-level stop fills.

## Production direction

To add true broker trading, obtain and verify an official xChief API/bridge and approved permissions. A native Android foreground service would need to be designed and tested for user-visible ongoing operation, battery optimization, connectivity loss, lifecycle restart and secure credentials. MT5 Android does not run Expert Advisors. A static PWA cannot safely substitute for a broker execution service.
