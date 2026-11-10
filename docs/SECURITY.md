# Security boundaries and operating guidance

## Current release boundary

This is a static browser research dashboard and paper-trading demo. It has no wallet adapter, private-key or seed-phrase handling, transaction signer, live order route, privileged API token, backend service, or database. No real trade can be submitted through this repository.

## Implemented controls

- Content Security Policy restricts scripts/styles to the page and same-origin resources (inline scripts/styles are retained for the current single-page UI); network connections are limited to the named public market data provider.
- Provider names, symbols, identifiers and event strings are escaped before rendering as HTML.
- Provider data is checked for expected Solana chain, mint address format, matching base-token address, and positive finite price.
- Public market data older than five minutes blocks new paper entries.
- Paper state is schema-checked and bounded when restored from browser storage.
- Paper entry, fee/slippage assumptions, position count, daily loss and high-water drawdown are enforced in an isolated engine with automated tests.
- No UI control can bypass a risk lock; a reset starts a new virtual account and clears local simulation history.

## Limits and residual risks

- Browser storage and browser JavaScript are controlled by the user and are not a trusted financial ledger.
- A static front end cannot enforce shared account permissions or provide server-side policy controls.
- DexScreener market data is untrusted, may be stale or incomplete, and does not prove a token is legitimate or sellable.
- Current security facts are placeholders/UNKNOWN. Do not treat liquidity, volume, or demo score as a token audit.
- Daily and drawdown locks block new simulated entries but do not close positions.
- The 1% configuration is notional sizing, not a maximum-loss cap.
- This MVP has no validated predictive model, no actual trading strategy backtest and no performance guarantee.

## Before any production or live use

- Complete a threat model and independent security review.
- Add independent on-chain evidence for mint/freeze authorities, token extensions, holder concentration, pool control/lock evidence and sellability.
- Add authenticated backend APIs, authorization, rate limits, monitoring, append-only audit logs and secure secret management.
- Use a separate isolated signer service only if strictly necessary; require independent policy authorization, transaction simulation and explicit user confirmation.
- Add provider freshness checks, retries/backoff, circuit breakers and data reconciliation.
- Test with fixtures and devnet/testnet, then perform independent audits. Never put private keys, seed phrases or API secrets in this repository, browser storage, issues, or logs.

Report suspected vulnerabilities privately to the repository owner rather than publishing exploit details.
