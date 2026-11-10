# ROAD TO CASH — Mobile Market Intelligence Terminal

A phone-first market research dashboard for Solana token discovery and XAU/USD (gold) reference analysis, with local paper-trading simulations. It is designed as an installable Progressive Web App (PWA) for a personal phone.

## Gold / XAUUSD module

- Optional local monitoring toggle: one button starts periodic reference-data checks and the same button stops them.
- Public XAUS spot and intraday reference feed, polled once per minute while the app is visible.
- 2-minute sampled reference series (up to 24 hours), analyzed with EMA 20, EMA 50, RSI 14, recent range and momentum.
- BUY BIAS / SELL BIAS / WAIT are directional indicator alignments, not trade orders, win probabilities or profit forecasts.
- Data-state validation rejects unavailable, stale, incomplete or insufficient data.
- Local paper Gold trades with a virtual balance, assumed entry/exit fee, simulated stop and target, and simple local daily-loss/drawdown locks.
- Positions and history are stored in this browser's local storage on this device.
- PWA manifest, app icon and service worker cache the app shell for home-screen installation and offline loading.

### Critical distinction: spot reference is not a broker quote

The Gold feed is an independent indicative XAU/USD mid-market reference price. It is not the xChief MT5 XAUUSD Bid/Ask quote, not an executable CFD price, and not settlement-grade. The 2-minute samples do not provide MT5 ticks or full OHLC candles. Therefore the Gold module is for reference analysis and local paper simulation only. Paper stops are checked at each fetched sample; they are not guaranteed broker stop orders or exact fills.

## Phone-only behavior

- No VPS, desktop terminal, API server or database is required for this local reference-analysis mode.
- Install the PWA from a secure HTTPS host such as GitHub Pages, then add it to the Android home screen.
- Monitoring runs only while the page is in the foreground. When Android backgrounds or suspends the app, polling is paused and resumes when the app becomes visible. A service worker caches the app shell only; it does not run a continuous trading loop.
- Paper state is local to this browser/device and can be cleared by browser storage settings or the in-app reset.
- This is a PWA, not a signed Android APK.

## Solana module

- SCOUT discovery from synthetic fixtures or optional public DexScreener pair snapshots.
- FILTER surface treats contract/holder/sellability evidence as unverified.
- ANALYST score placeholders are not a trained AI model.
- EXECUTOR supports local paper buy/close only.
- No wallet adapter, key storage, transaction signing or live Solana orders.

## Run locally

Requires Node.js 22 for tests and a modern browser.

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. Service-worker installation requires HTTPS or localhost.

Run quality checks:

```bash
node --test tests/*.test.cjs
node scripts/smoke-check.cjs
```

Market-data fetch requires internet. The XAUS service documents freshness metadata, attribution, and its price as indicative rather than tradable.

## Deploy / install

1. In GitHub, open **Settings → Pages** and choose **GitHub Actions** as the build source.
2. The Pages workflow packages `index.html`, `manifest.webmanifest`, `service-worker.js`, `js/`, and `assets/`.
3. After deployment, open the Pages URL in Chrome on the phone and choose **Install app** or **Add to Home screen**.
4. If the private repository's plan/settings do not permit Pages, host the same static files on another HTTPS static host. No secrets are required.

## Not implemented

- No xChief broker API or MT5 account connection.
- No real order placement, live stop-loss/TP, automatic broker trade management, or copy trading.
- No continuous background worker while Android has suspended the PWA.
- No tick-level/MT5 OHLC data, independent strategy backtest, trained predictive model or verified profitability.
- No native Android APK.

Any future broker execution requires a separately reviewed official broker integration, native Android foreground-service design, explicit authorization, independent risk controls and demo testing. Never put trading passwords, API secrets, private keys or seed phrases in this repository or browser storage.

## Sources

- Gold reference data: https://xaus.com/api/
- MetaTrader 5 Android does not run Expert Advisors; see https://www.metatrader5.com/en/terminal/help/algotrading/trade_robots_indicators
- Android background execution limits: https://developer.android.com/about/versions/oreo/background

Private repository: https://github.com/Talal-mbt/road-to-cash
