# Better Auth on percolator.tech (draft, not production)

User accounts are planned to live on `https://percolator.tech` with Better Auth mounted at the default `basePath` `/api/auth`. This branch wires the server, the `/api/auth` Worker route, and the browser client. It is **not** merged to production and must not be deployed until the owner approves an auth deploy.

## What is already wired

- Server: `worker/src/auth.js` — `createAuth(env)` uses `betterAuth()` with `baseURL` `https://percolator.tech`, `basePath` `/api/auth`, `database: env.AUTH_DB` (Cloudflare D1, auto-detected; no custom adapter), and the `sentinel()` plugin from `@better-auth/infra`.
- Route: `worker/src/worker.js` calls `handleAuth` for `/api/auth` and `/api/auth/*`. If `AUTH_DB` or `BETTER_AUTH_SECRET` is missing, the handler returns 503 and does not pretend signup works.
- Client: `worker/src/auth-client.js` — `createAuthClient` with `sentinelClient` from `@better-auth/infra/client`, `autoSolveChallenge: true`, and `sentinelHeaders: "modern"` (must match the server).

## Database adapter and paid infra

- Preferred adapter: **Cloudflare D1** via `database: env.AUTH_DB`. Better Auth 1.5+ treats a D1 binding as a first-class database. D1’s free tier is enough to start. This does **not** require paid Postgres.
- Do not reuse or extend the Render free Postgres instance that already backs install-counter data (that instance expires 2026-11-24, America/New_York) without a separate approval.
- Paid items that need owner approval before production auth:
  - Better Auth Infrastructure (Sentinel is a pro-plan feature).
  - Any paid D1 or Postgres upgrade, if free quota is not enough.
  - An email/SMS provider if we later require verification or magic links (none is configured now).
  - Hosted wallet custody (not part of this design; wallets stay user-controlled).

The D1 database itself is **not created** on this branch.

## Secrets

Never print, commit, or put these in `wrangler.toml` `[vars]` or source.

- `BETTER_AUTH_SECRET` — session signing secret, Worker secret only.
- `BETTER_AUTH_API_KEY` — Better Auth Infrastructure key, Worker secret only. Use the rotated key. Do not use a key that was pasted in chat. On Cloudflare Workers, pass it as `env.BETTER_AUTH_API_KEY` because `process.env` is not automatically populated the way it is in Node.

Setting either value on the production host is an environment-variable change and must only happen as part of an approved percolator.tech auth deploy, then be reported.

## What Sentinel does

Sentinel is Better Auth’s abuse-protection plugin. It evaluates sign-in and sign-up (and related) traffic against:

- credential stuffing (failed attempts per visitor, then PoW challenge or block)
- impossible travel
- optional geo-blocking
- bot blocking
- suspicious IPs
- velocity / rate limits
- free-trial / multi-account abuse via device fingerprint
- compromised passwords (Have I Been Pwned, k-anonymity: only the first 5 characters of the password hash leave the server)
- email validation and normalization
- stale-account activity

The browser plugin fingerprints a visitor id and can auto-solve Proof-of-Work challenges. Events are visible in the Better Auth Security dashboard. Telemetry goes to Better Auth infrastructure (`dash.better-auth.com`, `kv.better-auth.com`).

## Risks

- Device fingerprinting and visitor-id tracking.
- False-positive challenges or blocks (VPNs, travel, shared IPs).
- Geo-blocking can lock out legitimate users (left off until there is a country policy).
- Email and traffic signals are sent to Better Auth infra.
- PoW can add latency; missing `BETTER_AUTH_API_KEY` falls back to allow mode (documented Sentinel warning).
- Header mismatch (`legacy` vs `modern`) or missing CORS expose/allow headers will break challenges on cross-origin clients.

## Best practices (from Better Auth docs)

1. Start with `log` (and `challenge` before `block`); tune thresholds from real traffic.
2. Keep `sentinelHeaders: "modern"` on server and client (proxy-safe `X-Sentinel-*` names).
3. Enable `autoSolveChallenge` on the client.
4. For cross-origin browser clients, allow and expose the exact `X-Sentinel-*` header names; do not use `origin: "*"` with credentialed cookies.
5. Monitor the Security dashboard; do not turn on admin email alerts until a mail transport exists.
6. Never ship the API key in the client bundle.

## Step-by-step setup (when an auth deploy is approved)

1. Create a free-tier D1 database, suggested name `percolator-auth`. Bind it as `AUTH_DB`. Record that this is a new database, not paid Postgres.
2. Generate a `BETTER_AUTH_SECRET` and set it as a Worker **secret**. Set `BETTER_AUTH_API_KEY` as a Worker **secret** using the rotated key only. Do not put either in `[vars]` or git. Report both as production env-var changes.
3. Evaluate adding `compatibility_flags = ["nodejs_compat"]` if the Better Auth Worker bundle requires it; test `/`, `/feed`, `/api/health`, and legal pages still work.
4. Run Better Auth programmatic migrations (`getMigrations` from `better-auth/db/migration`) against `AUTH_DB` from a Worker. Do not expose an unauthenticated `/migrate` route.
5. Deploy this Worker **script plus** the new binding/secrets, keeping existing ASSETS and Privy/GitHub bindings. Do not wrangler-deploy without the Assets bundle.
6. Confirm `GET/POST https://percolator.tech/api/auth/*` is served by Better Auth (no longer 404/503).
7. Import `authClient` from `worker/src/auth-client.js` in the site UI.
8. Update the Privacy Policy before collecting emails or account data.
9. Watch Sentinel in log/challenge mode, then tighten actions.

## Privacy

Account email, password hashes, sessions, and Sentinel visitor identifiers are not collected in production today (`/api/auth` is not live). The published Privacy Policy says so and must be revised before this lands.
