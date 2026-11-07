# ROAD TO CASH — Solana Trading Intelligence Terminal

A dark, signal-first interface for Solana token discovery, market screening, explainable analysis, and **paper-only** portfolio simulation.

> **Safety:** This repository is a research/demo MVP. It does not execute live trades, connect to a wallet, or sign transactions. Demo token data is synthetic. Public DexScreener market metrics do not establish token security. Nothing here is financial advice.

## Included in this MVP
- Overview dashboard and virtual equity / PnL displays.
- SCOUT discovery workspace with synthetic demo assets and optional public DexScreener fetch.
- FILTER panel illustrating fail-closed security checks (unknown facts remain unverified).
- ANALYST explainability factor display.
- EXECUTOR paper buy/close controls with simulated fees and slippage.
- RISK ENGINE pause toggle and illustrative guardrail settings.
- LOGGER event stream and system health status.
- Responsive desktop/mobile terminal layout.
- GitHub Pages workflow for static deployment.

## Run locally
Requires a modern browser. From the repository root:
```bash
python3 -m http.server 4173
```
Visit http://localhost:4173. DexScreener fetch requires internet access and may be limited by upstream CORS/rate limits.

## Deploy to GitHub Pages
1. Open **Settings → Pages** in the repository.
2. Set deployment source to **GitHub Actions**.
3. Push to `main` or run the Pages workflow manually from **Actions**.

## Important limitations
- Demo assets, prices and the illustrative equity chart are not actual market or trading performance.
- The browser-side paper account is ephemeral and not a durable or audited portfolio.
- DexScreener provides market/pair statistics only; it is not a contract security provider.
- There is no wallet adapter, key management, transaction signer, live order route, backend, or database.
- Public provider responses should be treated as untrusted external data.

## Suggested roadmap
1. Integrate independent on-chain token authority, holder distribution, extension, liquidity and sellability evidence.
2. Build a backend API + durable storage + append-only decision audit trail.
3. Add provider rate limits, retries, source timestamps and data-quality monitoring.
4. Perform a threat model and independent security review.
5. Keep any future live-execution system isolated, separately authorized and disabled by default.

Private repository: https://github.com/Talal-mbt/road-to-cash
