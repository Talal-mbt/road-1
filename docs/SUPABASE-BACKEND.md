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

- The static GitHub Pages frontend is not yet wired to Supabase Auth or these tables.
- Sign-up remains disabled in Supabase Auth; only existing invited/created accounts can sign in.
- hCaptcha is enabled at the project level, but the frontend hCaptcha site key has not yet been added. Login integration must render hCaptcha and pass its token to Supabase Auth.
- GitHub Pages serves static source files publicly. Auth can gate app functionality and protect database rows through RLS, but cannot make the HTML/JS source private.
- MT5 profiles are still metadata only. No broker bridge, cloud terminal, real orders, or persistent execution supervisor is deployed.
- The audit Edge Function is deployed but has not been exercised with a real signed-in session in this work session.

## Required next integration steps

1. Add the public hCaptcha site key to the frontend configuration (never the hCaptcha secret).
2. Implement Supabase Auth sign-in/session refresh/sign-out and role resolution in the PWA.
3. Migrate local preferences and paper trading data into per-user tables with safe reconciliation and rollback.
4. Add admin UI backed by server-verified roles and RLS; never expose role mutation in the client.
5. Add automated authenticated/RLS integration tests and exercise the Edge Function with a real session.
6. Keep live trading disabled until an xChief Demo compatibility test, provider authorization, risk supervision, and independent review are complete.
