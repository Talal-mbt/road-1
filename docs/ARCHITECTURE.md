# Architecture

## Current release

This repository is a static browser app hosted by GitHub Pages. It has no backend or database.

- `index.html`: responsive dashboard and UI wiring.
- `js/paper-engine.js`: isolated, deterministic paper portfolio accounting and local risk rules.
- `tests/paper-engine.test.cjs`: unit tests for simulation state, entry/exit accounting, and circuit breakers.
- `scripts/smoke-check.cjs`: static integrity checks for required UI wiring and the no-live-wallet boundary.
- `.github/workflows/quality.yml`: Node test and smoke-check workflow.
- `.github/workflows/pages.yml`: packages the static page and its JavaScript dependency for GitHub Pages.

## Data flow

1. The app loads bounded local paper state from browser storage, or creates a fresh virtual account.
2. Synthetic fixtures populate the first view. Optional SCOUT requests public DexScreener token profiles and Solana pair snapshots.
3. Provider fields are validated before display. Names, symbols, ids and event strings are HTML-escaped. External data is not treated as security evidence.
4. Public data snapshots older than five minutes cannot be used to open new paper positions.
5. The paper engine models notional sizing, entry/exit slippage and fees, realized/unrealized PnL, and local circuit breakers.
6. The event log and positions persist best-effort in local storage. This persistence is user-editable, device-local, and not an audited ledger.

## Current risk semantics

- One simulated entry is limited to 1% of marked virtual equity by **notional**, not by worst-case loss.
- At most three virtual positions may be open.
- A 2% daily loss or 5% drawdown from the local high-water mark locks new entries.
- Manual pause also blocks new entries.
- Risk locks remain sticky until the local paper account is reset. Reset is destructive and requires browser confirmation.
- Closing positions remains available after a pause. No forced liquidation is simulated.

## Production architecture direction

Use a separately deployed API, worker, durable relational database, queue, authenticated admin surface, and append-only audit events. Provider adapters need schema validation, source timestamps, retries/backoff, circuit breakers, rate limits, and data-quality metrics.

Keep research, policy evaluation, and any future signing/execution services isolated. The frontend must never hold private keys or have permission to sign transactions. All live actions, if ever implemented, require server-side authorization, transaction simulation, policy checks, explicit opt-in and independent security review.
