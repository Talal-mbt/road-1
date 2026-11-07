# Architecture (MVP)

## Browser app
`index.html` contains the standalone responsive terminal UI and the demo state/control logic. It can be hosted as static content on GitHub Pages.

## Data flow
- Synthetic demo market fixtures populate the dashboard initially.
- SCOUT optionally fetches public latest token profiles from DexScreener, then public pair snapshots for Solana.
- The provider data is displayed as market metrics only. Contract authority and holder evidence remain unknown.
- EXECUTOR simulates virtual paper entries and exits, including simplified fee/slippage assumptions.
- LOGGER records browser-session actions in memory.

## Components represented in the interface
- SCOUT: candidate discovery
- FILTER: fail-closed security gate concept
- ANALYST: heuristic/explainability surface
- EXECUTOR: paper execution only
- RISK ENGINE: pause and illustrative limits
- LOGGER: event trail
- System health: readiness/status display

## Production architecture direction
Consider a separately deployed API service, worker, durable relational store and queue. Use provider adapters with source timestamps, normalization, retry/backoff, circuit breakers and quality metrics. Append immutable decision and execution audit events. Keep any future transaction signing component isolated with independent authentication, policy enforcement and secret management.
