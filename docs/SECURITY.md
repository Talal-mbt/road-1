# Security notes

## Current release boundary
This MVP is a standalone browser application and paper-trading demonstration. It has no wallet connection, private-key storage, transaction signing, live trading API, backend persistence, or privileged credentials.

## Safe handling
- Do not add private keys, seed phrases, wallet exports, access tokens, or other secrets to this repository.
- Do not paste secrets into browser local storage, issue reports, logs, or screenshots.
- Treat all market/provider data as untrusted and potentially stale or manipulated.
- Market liquidity/volume does not prove contract safety or ability to sell.
- Unknown security facts should be represented as UNKNOWN and must not be interpreted as safe.

## Before any production use
- Conduct a formal threat model and independent audit.
- Validate mint/freeze authority, token extensions, holder concentration, pool ownership/lock evidence, and sellability using reputable independent sources.
- Implement backend authentication, authorization, rate limiting, audit logging, secure secret management and monitoring.
- Isolate signing/execution from frontend and research services; require explicit policy checks and authorization.
- Add circuit breakers, position/exposure limits, daily loss limits and kill switches enforced server-side.
- Use testnet/devnet before any live transaction flow.
- Never treat heuristic scores as guarantees or financial advice.

Report suspected vulnerabilities privately to the repository owner rather than opening a public issue with exploit details.
