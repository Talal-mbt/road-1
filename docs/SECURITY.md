# Security boundaries and operating guidance

## Current release boundary

ROAD is a static browser/PWA research dashboard and paper simulator. It has no wallet adapter, private-key or seed-phrase handling, transaction signer, xChief credentials, MT5 account session, broker API, live order route, backend service or database. No real trade can be submitted through this repository.

## Implemented controls

- Content Security Policy limits outbound connections to the named public providers.
- External provider fields and event strings are escaped before HTML rendering.
- Gold feed validation requires fresh-state metadata, timestamped spot price, sufficient 2-minute samples and a recent final sample.
- Old/unavailable quote data disables new Gold paper entries.
- PWA service worker caches only same-origin app-shell files and deliberately does not cache external market data.
- Gold paper state is schema-checked on restore, capped at three open positions, and has local 2% daily-loss / 5% high-water drawdown circuit breakers.
- Gold monitoring is user-started and uses the same button to stop. Polling pauses while the page is hidden and resumes only after it returns to foreground.
- Paper trade state and history remain local to this device/browser.

## Market-data caveats

XAUS provides an indicative XAU/USD spot reference price. It is not xChief's executable CFD quote, not bid/ask, and should not be used for broker order placement. The provider's intraday series is sampled every two minutes; it is not a tick feed or a full MT5 OHLC history. A stale or incomplete feed is rejected. No score indicates the probability of profit.

## Android / background caveats

The PWA does not run a continuous worker while Android has suspended the app. The service worker serves static app files offline, not continuous market monitoring. The browser may suspend timers when backgrounded, and polling deliberately pauses when the page is hidden. This is not a native Android APK or an MT5 Expert Advisor.

## Before any future live use

- Obtain documented permission and a verified official broker API/bridge; do not use undocumented third-party credential bridges.
- Keep credentials out of source control and browser local storage. Prefer hardware-backed secure storage and a reviewed native service.
- Implement authenticated server-side risk authorization or a carefully audited native foreground execution model.
- Add tick-level broker data, Bid/Ask spread, slippage, commission, margin checks and execution reconciliation.
- Complete threat modeling, dependency review, independent security audit and extensive demo testing before any live-mode discussion.

Never paste trading passwords, API secrets, private keys or seed phrases into this repository, issues, screenshots or logs.
