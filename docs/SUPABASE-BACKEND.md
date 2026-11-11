# ROAD Supabase backend status

Project: `Road` (`oinojqdxzyxurvrskhgs`), region `eu-central-1`.

## Implemented on 2026-11-11

- Revoked client execution of `public.rls_auto_enable()`; only the database owner retains execution.
- Created `public.user_roles` with RLS and no client-side write privileges. The existing auth user was granted the `admin` role.
- Role helper lives in the non-exposed `private` schema; clients cannot choose an arbitrary user ID to test.
- Created RLS-protected tables: `profiles`, `user_settings`, `paper_accounts`, `paper_trades`, `mt5_profiles`, and `audit_logs`.
- New auth users receive a profile and settings row through a database trigger.
- MT5 table is metadata only. Never store broker credentials or provider secrets.
- Deployed `road-audit-event` Edge Function with JWT verification. It validates the session and only accepts allow-listed non-secret event metadata.

## Current limitations — do not claim production complete

- Supabase Auth sign-in, session refresh, sign-out, and per-user role lookup are now wired into the PWA on the feature branch. The existing application is hidden until a valid session and role are confirmed.
- Sign-up remains disabled in Supabase Auth; only existing invited/created accounts can sign in.
- The supplied public hCaptcha site key is configured in the frontend; the widget token is submitted with password sign-in. Confirm the hCaptcha key's allowed hostnames include `talal-mbt.github.io` before testing on GitHub Pages.
- GitHub Pages serves static source files publicly. Auth can gate app functionality and protect database rows through RLS, but cannot make the HTML/JS source private.
- MT5 profiles are still metadata only. No broker bridge, cloud terminal, real orders, or persistent execution supervisor is deployed.
- The audit Edge Function is deployed but has not been exercised with a real signed-in session in this work session.

## Remaining integration and release gates

1. Verify the hCaptcha hostname allowlist and complete an interactive login test with the existing admin account; credentials are never requested in chat.
2. Add authenticated integration tests for role lookup, RLS isolation, and the `road-audit-event` Edge Function.
3. Migrate local preferences and paper-trading data into per-user tables with safe reconciliation, duplicate detection, and rollback. No local trading history is uploaded automatically yet.
4. Build the admin UI backed by server-verified roles and RLS; never expose role mutation in the client.
5. Keep live trading disabled until an xChief Demo compatibility test, provider authorization, risk supervision, and independent review are complete.

## Frontend authentication implementation

- `js/road-auth.js` uses the Supabase Auth REST endpoints and the project's publishable API key (safe for browser use; RLS remains the authorization boundary).
- Password sign-in includes the hCaptcha `captcha_token`; signup is not exposed.
- The frontend refreshes the session, verifies `/auth/v1/user`, then reads the signed-in user's own `user_roles` row before revealing the workspace.
- The client stores only the Supabase session in browser storage. No service-role key, hCaptcha secret, or broker credential is present in the frontend.
- This is an access gate, not source-code secrecy: GitHub Pages HTML/JS remains publicly downloadable. The code and DB protections still require review before merging/deployment.
