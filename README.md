# ROAD — Market Intelligence

**ROAD** is a mobile-first market intelligence workspace for XAU/USD gold analysis, Solana market discovery, risk visibility and local paper-trading simulations. The interface is Arabic-first, supports Arabic/English switching, and can be installed on an Android home screen as a Progressive Web App (PWA).

> **Execution boundary:** this release is an analysis and paper-simulation app. It is not connected to an MT5 broker account and cannot submit real orders.

## Product modules

### Dashboard
- Portfolio snapshot for the local virtual account.
- Quick access to Gold, Trades, Markets and Risk.
- Market candidate list, activity feed and system status.
- Responsive layout for phone and desktop.

### Gold intelligence — XAUUSD
- Indicative XAU/USD reference feed from XAUS.
- EMA 20, EMA 50, RSI 14, short-term momentum and recent range.
- Directional states: BUY BIAS, SELL BIAS or WAIT.
- Freshness checks that reject stale or incomplete reference data.
- User-controlled monitoring toggle; polling runs while the page is visible.

**Gold quotes are indicative spot references, not xChief MT5 Bid/Ask prices or executable CFD prices.** Intraday samples are not an MT5 tick feed. Gold signals are indicator alignment, not a win probability or a trade instruction.

### Paper trading
- Separate local simulation for Gold and Solana candidates.
- Virtual balance, positions, simulated fees/slippage and trade history.
- Paper risk limits and circuit breakers.
- Best-effort local browser persistence on the current device.

Paper accounting is illustrative. It is not an audited ledger, a broker fill simulator, a guarantee of maximum loss, or evidence of profitability.

### Markets — Solana discovery
- Synthetic starter fixtures and optional public DexScreener pair snapshots.
- Candidate display for price, liquidity and volume.
- Unverified token-security facts remain explicitly unverified.
- No wallet adapter, private-key handling, transaction signing or live Solana execution.

### MT5 account profiles
- Local profile metadata for Demo or Real: account login and server name.
- Profile selection and removal on the current device.
- No MT5 password is collected or stored.
- Saving a profile does **not** connect to a broker. No MT5 bridge or real order endpoint is enabled.

## Brand and install identity

- Product name: **ROAD**
- Repository: [Talal-mbt/road-1](https://github.com/Talal-mbt/road-1)
- GitHub Pages app: https://talal-mbt.github.io/road-1/
- PWA display name: ROAD
- App icon: `assets/app-icon.svg`

The app migrates locally stored settings and paper data from the previous internal storage-key namespace to the current `road.*` namespace on first launch. This is a local browser migration; it does not transmit stored data.

## Phone installation

1. Open https://talal-mbt.github.io/road-1/ in Chrome on Android.
2. Choose **Install app** or Chrome menu → **Add to Home screen**.
3. Reopen the installed app. The service worker caches the app shell only.
4. Online market data is fetched when a module requests it. When offline, the app remains open and shows that live data is unavailable.

The PWA does not provide guaranteed continuous background execution. Android may suspend background tabs or installed web apps; Gold polling pauses when the app is hidden and resumes when it returns to the foreground.

## Development and quality checks

Requires Node.js 22 for automated checks.

Run the local static app:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173. Service-worker installation requires HTTPS or localhost.

Run all unit tests and smoke checks:

```bash
node --test tests/*.test.cjs
node scripts/smoke-check.cjs
```

GitHub Actions runs the same test and smoke-check commands. GitHub Pages deployment packages the HTML, PWA manifest, service worker, JavaScript modules and app icon.

## Current architecture

ROAD is currently a static PWA. It has no application backend, durable database, broker connection service, cloud MT5 terminal, native Android foreground service or server-side account authorization.

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security boundaries](docs/SECURITY.md)
- [MT5 cloud integration plan](docs/MT5-CLOUD-INTEGRATION.md)

## Roadmap — not yet implemented

1. A secure backend for user accounts, account-profile ownership and audit logs.
2. A verified, official broker integration or an approved managed MT5 cloud bridge.
3. Separate Demo and Real account isolation and server-side risk authorization.
4. Reconciliation of broker positions, orders, commissions, swaps and fills.
5. Native Android service design if persistent user-visible monitoring is required.
6. Independent security review, demo forward testing and broker compatibility validation.

Any future live-trading capability must be disabled by default, require explicit user arming, use server-side risk controls, and pass Demo testing first. Never commit MT5 passwords, broker tokens, API credentials, private keys or seed phrases.
