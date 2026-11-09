# Better Auth on percolator.tech

User accounts live on `https://percolator.tech` with Better Auth mounted at the default `basePath` `/api/auth`. The auth application itself runs on Railway (project `percolator-tech`, id `4d0c3382-a848-453a-944a-4528662c977a`; service `percolator-auth`, id `45d9f983-6b97-4d05-9934-0c79ef9e4acb`; environment `production`, id `cdce3d00-e97a-446f-97a4-1533abeecb20`) and stores records in Neon Postgres. The public Railway origin is `https://percolator-auth-production.up.railway.app`. The service listens on `PORT=3000` to match the Railway domain target port. The Cloudflare Worker at percolator.tech proxies `/api/auth` and `/api/auth/*` to that service so first-party cookies stay on the apex domain.

## Why self-hosted Better Auth, not Neon Auth as the IdP

The same Neon project also exposes Neon Auth (a hosted Better Auth instance) at `NEON_AUTH_URL` and a JWKS at `NEON_AUTH_JWKS_URL`. We still run our own Better Auth process on Railway because we need:

- `baseURL` `https://percolator.tech` and `basePath` `/api/auth`
- first-party session cookies on percolator.tech via the Worker proxy
- the Sentinel plugin in log/challenge mode with `sentinelHeaders: "modern"`

Neon Auth issues tokens under a different issuer than this service. This deploy does not verify Neon Auth JWTs as logins, because that would mix two user stores. The Neon Auth URL and JWKS are recorded as config on the Railway service for a later integration if we need one.

## What is wired

- Server: `auth-server/src/auth.js` and `auth-server/src/server.js` — `betterAuth()` with a `pg` Pool, `baseURL` `https://percolator.tech`, `basePath` `/api/auth`, and the `sentinel()` plugin from `@better-auth/infra`.
- Migrations: `auth-server/scripts/migrate.js` uses `getMigrations` from `better-auth/db/migration`. There is no public `/migrate` route. Railway runs the script as a pre-deploy command.
- Proxy: `worker/src/auth.js` forwards `/api/auth/*` to `env.AUTH_UPSTREAM` (the Railway origin). If `AUTH_UPSTREAM` is missing, the Worker returns 503.
- Client: `worker/src/auth-client.js` — `createAuthClient` with `sentinelClient` from `@better-auth/infra/client`, `autoSolveChallenge: true`, and `sentinelHeaders: "modern"` (must match the server).

## Database and paid infra

- Database: the owner-provided Neon Postgres instance, via `DATABASE_URL` on Railway. Do not print this value.
- The Railway service is a normal small Node app in the existing workspace. Do not add paid Railway databases, volumes, or higher limits without approval.
- Paid items that still need owner approval:
  - Better Auth Infrastructure (Sentinel is a pro-plan feature).
  - Any paid Neon or Railway upgrade, if free or current quota is not enough.
  - An email/SMS provider if we later require verification or magic links (none is configured now).
  - Hosted wallet custody (not part of this design; wallets stay user-controlled).

## Secrets and config

Never print, commit, or put secrets in `wrangler.toml` `[vars]`, `railway.json`, or source.

Railway (auth service):

- `DATABASE_URL` — Neon Postgres connection string (secret).
- `BETTER_AUTH_SECRET` — session signing secret (secret).
- `BETTER_AUTH_API_KEY` — Better Auth Infrastructure key, rotated value only (secret).
- `BETTER_AUTH_URL` — `https://percolator.tech`.
- `BETTER_AUTH_BASE_PATH` — `/api/auth`.
- `NEON_AUTH_URL` and `NEON_AUTH_JWKS_URL` — public Neon Auth endpoints, recorded as config only.
- `NODE_ENV` — `production`.

Cloudflare Worker:

- `AUTH_UPSTREAM` — Railway public origin, no path (plain text). Do not put `BETTER_AUTH_SECRET` or `BETTER_AUTH_API_KEY` on the Worker.

## Sentinel

Sentinel is Better Auth’s abuse-protection plugin. It evaluates sign-in and sign-up (and related) traffic against credential stuffing, impossible travel, bots, suspicious IPs, velocity, free-trial / multi-account abuse via device fingerprint, compromised passwords (Have I Been Pwned, k-anonymity), and email validation / normalization.

The browser plugin fingerprints a visitor id and can auto-solve Proof-of-Work challenges. Telemetry goes to Better Auth infrastructure (`dash.better-auth.com`, `kv.better-auth.com`). This deploy starts in log / challenge mode, not block.

## Privacy

The published Privacy Policy must describe account data (email, password hashes, sessions), Neon and Railway as recipients, and Sentinel device / email / traffic collection before `/api/auth` is live.
