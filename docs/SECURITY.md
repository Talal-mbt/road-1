# ROAD — Security boundaries and operating guidance

## Current release boundary

ROAD is a static browser/PWA research dashboard and paper simulator. It has no wallet adapter, private-key or seed-phrase handling, transaction signer, xChief credentials, MT5 account session, broker API, live order route, backend service or database. No real trade can be submitted through this repository.

## Implemented controls

- Content Security Policy limits outbound connections to the named public providers.
- External provider fields and event strings are escaped before HTML rendering.
- Gold feed validation requires explicit fresh-state metadata, quote timestamps, sufficient two-minute samples and a recent final sample.
- Stale or unavailable Gold data disables new paper-trade actions.
- The service worker caches same-origin app-shell files only; external provider data is not cached.
- Gold paper state is schema-checked on restore, capped at three open positions and subject to local 2% daily-loss / 5% high-water drawdown locks.
- Monitoring is user-started and user-stopped. Polling pauses while the app is hidden or offline and resumes when the page becomes visible and online.
- MT5 account profiles contain only a login identifier, server name and Demo/Real label. No password is stored.

## Market-data caveats

XAUS provides an indicative XAU/USD spot reference price. It is not xChief's executable CFD quote, not Bid/Ask and not a tick-level MT5 feed. The intraday series is sampled; local paper stops do not represent broker stop orders or guaranteed fills.

## Android and offline caveats

The PWA shell can load from cache, but live prices are unavailable while offline. The app remains open and communicates offline state. Android may suspend background pages; no continuous background execution is promised.

## MT5 account caveat

The MT5 profile screen currently stores local metadata only. A saved login/server profile is not a connected account. Do not enter a trading password into the static PWA. A future connector must use an approved secure flow and keep credentials and API tokens server-side.

## Before any live use

- Verify an official or explicitly authorized broker/MT5 bridge.
- Keep credentials out of source control, browser localStorage and logs.
- Add authenticated backend APIs, ownership checks, least privilege, rate limits and append-only audit records.
- Enforce position sizing, margin checks, stop-loss requirements, daily loss limits and execution reconciliation server-side.
- Complete a threat model, dependency review, independent security audit and extensive Demo forward testing.
- Keep Real mode disabled until all gates pass and the user explicitly arms the account.

Never paste MT5 passwords, API secrets, private keys or seed phrases into this repository, issues, screenshots or logs.
