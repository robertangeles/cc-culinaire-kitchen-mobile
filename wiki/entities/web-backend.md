---
title: Web backend (cc-culinaire-kitchen)
category: entity
created: 2026-04-29
updated: 2026-04-29
related: [[screens]], [[antoine]]
---

The shared Express + Drizzle + Postgres backend that handles auth, subscription, and (future) conversation metadata sync for both the mobile app (this repo) and the CulinAIre Kitchen web app.

## Quick facts

- **Repo:** https://github.com/robertangeles/cc-culinaire-kitchen (cloned locally at `c:\My AI Projects\cc-culinaire-kitchen`)
- **Production URL:** `https://www.culinaire.kitchen` (use the `www` host — apex 301-redirects strip Bearer auth on GETs)
- **Local dev URL:** `http://localhost:3009`
- **Hosting:** Render (NOT Railway — there's a stale `railway.toml` in the web repo that should be ignored)
- **Stack:** Express, Drizzle ORM, Postgres
- **Auth:** JWT access + refresh, dual-mode (Bearer header for mobile, cookie for web)

## Mobile-relevant endpoints

| Path                       | Method | Purpose                                                                           |
| -------------------------- | ------ | --------------------------------------------------------------------------------- |
| `/api/auth/register`       | POST   | Create account                                                                    |
| `/api/auth/login`          | POST   | Email/password sign-in, returns `{ user, tokens: { accessToken, refreshToken } }` |
| `/api/auth/refresh`        | POST   | Refresh access token via refresh token                                            |
| `/api/auth/me`             | GET    | Current user (requires Bearer)                                                    |
| `/api/auth/google`         | POST   | Google ID token exchange                                                          |
| `/api/auth/mfa/verify`     | POST   | MFA challenge                                                                     |
| `/api/subscription/status` | GET    | (planned) Subscription state for paywall                                          |
| `/api/conversations/sync`  | POST   | (planned, P2) Metadata-only conversation sync                                     |
| `/api/model/version`       | GET    | (planned) Check for new Antoine version                                           |

## Authoritative contract

**The full API contract lives at [`raw/web-backend-api.md`](../../raw/web-backend-api.md).** That file is intentionally in `raw/` because it explicitly states "source files (in the web repo) win when they conflict." Do NOT edit that file as a wiki page — sync it FROM the web repo when the contract changes.

The mobile app derives its TypeScript types and `apiClient` calls from the shapes in that contract. The contract test suite (`src/__tests__/contract/web-backend.contract.test.ts`) hits the live backend to detect drift.

## Important gotchas

- **Always use `www`.** `https://culinaire.kitchen` 301-redirects to `https://www.culinaire.kitchen`, and Node + browser fetch strip the `Authorization` header on cross-origin redirects (security default). Bearer-authed GETs silently fail with 401 if you point at the apex. POSTs don't follow this code path, so the bug only surfaces on GETs.
- **Tokens stored in `expo-secure-store` only.** Never `AsyncStorage`. Refresh token rotates on every use.
- **Render env vars** required: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `CREDENTIALS_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY`, `OPENROUTER_API_KEY`, `CLIENT_URL`, `NODE_ENV`.
- **DB-backed credentials.** The web backend reads provider keys (Google, OpenRouter, etc.) from a Postgres `credentials` table at startup, not from `.env`. Mobile dev needs to verify the relevant rows exist before integrating.

## Cross-repo discipline

Read web repo's schema + controllers FIRST before designing mobile features. DB queries should only be used for runtime state, not contract derivation — read the source code.

## See also

- [[antoine]] — backend gates subscription, which gates Antoine download
- [[screens]] — Login + Onboarding screens depend on this backend
- `raw/web-backend-api.md` — the authoritative contract
- `src/__tests__/contract/web-backend.contract.test.ts` — drift detection
