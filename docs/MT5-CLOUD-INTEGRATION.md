# ROAD — MT5 / xChief Cloud Connector Plan

## Executive decision

A phone-only user interface can control automated MT5 trading without the user's own PC, but the trading terminal must still run somewhere. The MT5 Android app itself does not execute MQL5 Expert Advisors. The selected technical candidate for a phone-controlled design is a managed cloud MT5 connection such as MetaApi, subject to a successful xChief demo-account compatibility test and the user's acceptance of the third-party cloud credential exposure and cost.

This is **not yet an enabled live connector**. No broker account has been connected, no API credentials have been supplied, and no real orders have been sent.

## Verified constraints

1. MT5 account login requires the account number, password, and exact server. An investor password is read-only; trading needs master trading permissions.
2. The official xChief announcement dated 1 May 2024 lists `xChief-MT5` as the MT5 server name for its MT5 account types. The app must still let the user confirm the exact server from their own MT5 account screen; never silently assume the demo and live server strings are interchangeable.
3. MetaQuotes' Python integration connects to a running MT5 terminal executable, not to the MT5 Android app.
4. MetaApi documents cloud MT4/MT5 account provisioning, connection status, account information, positions, market data, trading and position close operations. It describes support for accounts at MetaTrader brokers generally; xChief server compatibility must be proved by connecting the user's actual demo account.
5. MetaApi supports a credential configuration link: the app creates a draft account without the login/password, then the owner enters the credentials in MetaApi's hosted configuration page. Credentials must never pass through the ROAD browser, GitHub, logs, chat or app database.
6. MetaApi is a paid cloud service. Its current pricing page lists a Regular subscription of USD 30/month, a 7-day trial, one free MT account, and additional API usage charges. Risk Management API features are separately charged per account/hour. Prices and quotas can change.
7. Android can host a user-visible foreground service, but OS versions impose background-start, service-type and quota restrictions. A native app can reduce background suspension; it cannot promise that Android will never kill the service or that a phone with no connectivity can trade.

## Selected topology

- Android native app: user interface, account selector (Demo/Real), start/stop control, notifications, secure local session storage.
- ROAD backend: authentication, account ownership mapping, policy/risk enforcement, audit log and broker-bridge calls. MetaApi access token is stored only as a server secret.
- MetaApi managed cloud terminal: persistent MT5 connection to the selected xChief account.
- xChief MT5 server: actual XAUUSD quote and order execution.

The phone is the only personal device needed for normal control. The trading terminal and strategy supervisor run in managed cloud infrastructure, not inside the phone. This is therefore phone-controlled/cloud-executed, not offline or fully local phone execution.

## Account onboarding

Every account is a separate profile with a type of DEMO or REAL. Never infer account type from login number.

Required flow:
1. User selects DEMO or REAL.
2. User enters a display name and confirms the exact MT5 server name shown by xChief/MT5. Suggested candidate: `xChief-MT5`, subject to demo verification.
3. Backend creates a MetaApi MT5 draft cloud account with a unique strategy Magic Number and requests a short-lived secure configuration link.
4. User opens that link and enters the MT5 login and master/investor password directly on the provider-hosted page.
5. Backend polls MetaApi provisioning status and terminal connection status. The app shows CONNECTED only after server-side connection and account synchronization have succeeded.
6. Backend reads account information and verifies login, server, currency, balance, equity, leverage, tradeAllowed, investorMode, trade mode, symbol availability and XAUUSD contract rules.
7. Investor mode is accepted for monitoring only. Automated execution requires verified trading permission.
8. Demo and Real accounts are never merged. The Real profile has a separate explicit arming confirmation, and the bot starts disarmed after every new connection, app reinstall, account switch or service restart.

Do not ask the user to send any trading password in chat. Do not store a MetaApi token in frontend JavaScript, localStorage, PWA cache or GitHub.

## Start / Stop semantics

- The same on-screen control arms and disarms the strategy.
- Starting requires a fresh connected account snapshot, explicit account selection, confirmed trading permission, valid symbol specification, acceptable spread, margin checks and risk limits.
- On Stop: reject new entries immediately; retain broker-side SL/TP on open positions; then follow the selected close policy. Default safe policy: manage existing positions with their server-side protection rather than silently deleting stops. Provide a separate emergency close-all-owned-positions command with confirmation.
- A connection drop, stale quotes, rejected order, excessive slippage, uncertain execution state or failed reconciliation disarms new entries and creates an alert.
- The service must reconcile actual broker positions and pending orders after reconnect before it can arm again.

## 3% session-profit rule

Use a per-activation baseline, not a lifetime balance figure:

- On Start, record the account Equity and server time after a clean synchronized snapshot.
- Target = 3% of that baseline Equity.
- The primary measure should be net session P/L, after realized and floating P/L, commission, swap and any bot-owned fees; exclude deposits, withdrawals, credits and unrelated manual activity.
- Best isolation: use a dedicated MT5 account for this bot. If the account contains manual trades or other EAs, the app must either track only its own Magic Number and associated deals or refuse account-wide auto-close mode.
- At target: stop new entries, cancel this bot's pending orders, close this bot's open positions, verify every ticket is closed and no bot-owned pending order remains, persist the final result, then disarm until the user manually starts another session.
- Do not close unrelated manual positions by default. An explicit separate account-wide close option would require a dedicated account and deliberate confirmation.
- The target is a trigger, not a guaranteed exact fill. Spreads, gaps, slippage, commissions, swaps, execution latency and market closures can cause the final result to be above or below 3%, or prevent a close from completing.
- If the app/backend loses connection, do not assume the 3% rule is still being watched. Broker-side SL/TP must remain on all positions; use a persistent cloud supervisor and alerting.

MetaApi's Risk Management API provides profit/drawdown trackers and real-time equity tracking. Its documentation describes tracker events/statistics; do not assume that creating a tracker automatically closes positions. The execution supervisor still needs to process the event and close verified bot-owned tickets.

## Leverage policy

The app must never try to increase leverage just to make a trade fit.

The public xChief margin schedule says maximum metal leverage depends on total account equity: 1:500 below USD 3,000; 1:250 from USD 3,000 to 19,999; 1:125 from USD 20,000 to 49,999; 1:50 from USD 50,000 to 99,999; and 1:25 from USD 100,000 upward. xChief says leverage automatically decreases when a threshold is reached and the reverse increase is applied once daily at 00:00 server time. The actual account information returned by the connected MT5 server is authoritative for the individual account; the public schedule can differ by legal entity, account type or changed broker terms.

The robot should read and display actual account leverage, calculate margin using broker-reported symbol specifications and order-calculation methods, and size positions by stop-loss risk. Leverage changes margin requirements; it does not reduce price-loss risk.

## Mandatory safeguards before live mode

- Demo connection verified against exact xChief server and symbol.
- Account login/server/currency/equity/leverage and XAUUSD contract specification match the MT5 terminal.
- Investor-mode accounts cannot trade.
- Per-order maximum risk and total open risk; hard maximum volume; no martingale, no unbounded grid, no averaging down.
- Mandatory server-side stop loss at order creation; order check, margin check and duplicate-order idempotency.
- Account-wide daily/weekly loss and drawdown lock plus the 3% activation-session target.
- Spread, tick age, slippage, trading-session and high-impact news filters.
- All bot orders tagged with a unique Magic Number and client identifier.
- Reconciliation after disconnect/reconnect; close requests must be confirmed by actual broker state, not only an HTTP success response.
- Immutable audit of signal, quote timestamp, calculated size, order request, broker ticket, fill price, fees, modifications and close reason.
- Demo forward test and independent review before any live arming.
- Real mode remains disabled by default and requires explicit user action.

## Critical low-balance warning

xChief's public account conditions list a minimum XAUUSD/metal order size of 0.01 lots for several account types. With a very small balance, the smallest allowed volume can exceed a conservative risk budget. The engine must reject such a trade rather than increase leverage, widen the loss budget or force an order.

## Compatibility gate — not yet verified

The server name `xChief-MT5` is published by xChief for MT5 accounts, and MetaApi supports cloud MT5 accounts generally. However, automatic broker detection and a successful connection to this exact xChief Demo account have not been verified in this repository. The first live integration test must be a Demo account only. If MetaApi cannot connect to the server, ask xChief for the official server details and whether it authorizes third-party terminal/cloud bridges. Do not reverse-engineer the MT5 protocol.

## Out of scope until verified

- No trading password entry in the ROAD app.
- No real order endpoint or live toggle in the current PWA.
- No automatic leverage mutation.
- No guarantee of a 3% profit, 85–90% win rate or positive returns.
- No claim that a mobile foreground service can run forever without OS interruption.
