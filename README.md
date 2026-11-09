# percolator.tech

Home page + install tracker for **$CLAWD Percolator**.

- `GET /` — home (story, devnet proof, program IDs, mainnet Route A, live markets, install counter)
- `GET /installs` — public stats page
- `GET /api/health` — health check
- `GET /api/installs/stats` — totals by source and by day (`source=test` excluded)
- `POST /api/install` — `{ "source": "skill"|"repo"|"template"|"agent"|"test", "agent_id?", "version?", "cluster?" }`
- `GET /i/<source>.sh` — one-liner ping script for installers
- `GET /api/markets` — proxy to clawd markets API

Educational / unaudited. No promised returns. Brand is **$CLAWD** only.

## Deploy

Render free web service `percolator-tech` + free Key Value `percolator-tech-kv`.

Env vars (set in Render only — never commit):

- `REDIS_URL` — from `percolator-tech-kv` connection string (Blueprint `fromService`)
- `DATABASE_URL` — optional; used if `REDIS_URL` is unset (Postgres path with `perc_` tables only)
- `IP_HASH_SALT` — long random secret for HMAC of client IPs (`generateValue` in Blueprint)
- `MARKETS_URL` — default `https://percolator.clawdchain.trade/api/markets`
- `PORT` — set by Render

Note: this workspace already has one free Postgres (`musebot-install-counter-db`, expires **2026-11-24 America/New_York**). Render allows only one free DB, so installs persist in free Key Value instead. KV free tier is ephemeral (persistenceMode off) — renew/migrate before relying on long history.

## Wire the install ping (do not skip)

### clawd-percolator skill

Add near the end of the skill's quick-start / install instructions (or a post-install hook in `scripts/`):

```bash
# Fire-and-forget install ping (never fails the install)
curl -fsS -m 5 https://percolator.tech/i/skill.sh | bash || true
# Or with metadata:
PERCOLATOR_VERSION=0.1.0 PERCOLATOR_CLUSTER=clawd \
  curl -fsS -m 5 https://percolator.tech/i/skill.sh | bash || true
```

### percolator-skill repo install scripts

At the end of each install script:

```bash
curl -fsS -m 5 https://percolator.tech/i/repo.sh | bash || true
```

### Percolator · Solana perps bot template

On first boot / template apply:

```bash
curl -fsS -m 5 -X POST https://percolator.tech/api/install \
  -H 'content-type: application/json' \
  -d "{\"source\":\"template\",\"agent_id\":\"$AGENT_ID\",\"version\":\"$VERSION\"}" \
  >/dev/null 2>&1 || true
```

Use `source=agent` for ad-hoc agent installs. Use `source=test` only for smoke tests (excluded from public counts).

## Local

```bash
npm i
IP_HASH_SALT=dev node server.js
# optional: DATABASE_URL=postgres://...
```

## Domain

Point `percolator.tech` and `www.percolator.tech` at the Render `*.onrender.com` host (Cloudflare DNS; add custom domains in the Render dashboard). Apex may need a Cloudflare CNAME flatten / CNAME to the onrender host.


## Cloudflare Workers (live)

Deployed as Worker `percolator-tech` on account `7640372571bf2d69ed5d58a6a6d8929e`.

- Live: https://percolator.tech/feed (full HTML) and https://percolator.tech/api/feed (JSON)
- Also: https://www.percolator.tech/feed and workers.dev URL
- Custom domains attached via `wrangler.toml` `[[routes]] custom_domain = true`
- Server-side `GITHUB_TOKEN` Worker secret (rate limits only; never client-side)
- Kani/keeper: `public/ops-snapshot.json` — refresh with `python3 scripts/refresh-ops-snapshot.py` then `npx wrangler deploy`

```bash
cd /workspace/percolator-tech
python3 scripts/refresh-ops-snapshot.py
npx wrangler deploy
```

## Live deploy

- **Service:** https://percolator-tech.onrender.com (Render free web `percolator-tech`, id `srv-dbou14c9v7es738d0i3g`)
- **KV:** `percolator-tech-kv` (`red-dbou01u1egvs7382s710`) for install events
- **Deploy source:** Render could not clone private `Solizardking/percolator-tech` (GitHub App not granted on that repo). Live deploys come from public `themusebook/x402-messaging` branch `percolator-tech-site`, directory `percolator-tech/`. This private repo stays the canonical source — grant Render access to it (or mirror) to switch the service repo URL.
- **Free Postgres:** blocked (workspace already has `musebot-install-counter-db`, expires **2026-11-24 America/New_York**). App still supports `DATABASE_URL` + `perc_` tables if a DB becomes available.


## Legal pages

`/privacy`, `/terms`, and `/support` are served by the live Cloudflare Worker `percolator-tech` (apex and www). Source for those routes is `worker/src/` (including `legal-pages.js`). Static copies also live at `public/privacy.html`, `public/terms.html`, and `public/support.html`.

Deploying legal routes updates the Worker script only and must not rotate or overwrite existing ASSETS, `GITHUB_TOKEN`, or Privy bindings.



## User auth

Better Auth is self-hosted on Railway (project `percolator-tech`, service `percolator-auth`) with Neon Postgres. The Cloudflare Worker proxies `https://percolator.tech/api/auth` to that service. See `worker/AUTH.md` and `auth-server/`.

Do not put `BETTER_AUTH_API_KEY` or `BETTER_AUTH_SECRET` on the Worker; those stay on Railway. The Worker only needs `AUTH_UPSTREAM` (the Railway origin). Deploys must keep existing ASSETS and Privy/GitHub bindings.

`python3 scripts/embed-legal-pages.py` rebuilds `worker/src/legal-pages.js` from `public/privacy.html`, `public/terms.html`, and `public/support.html`.

