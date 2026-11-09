# percolator-install

Cloudflare Worker for **https://install.percolator.tech** — tracks installs of the clawd-percolator skill, percolator-skill repo scripts, and Percolator · Solana perps template/agent bots.

- D1: `percolator-installs` (binding `DB`)
- Secret: `IP_HASH_SALT` (HMAC of client IP; raw IPs never stored)
- Does **not** touch the `percolator-tech` Worker (apex/www)

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Public stats page |
| GET | `/api/health` | Health |
| GET | `/api/installs/stats` | Totals by source/day; excludes `source=test`; CORS `*` |
| POST | `/api/install` | `{source, agent_id?, version?, cluster?}` + rate limit |
| GET | `/i/<source>.sh` | One-liner ping (`skill\|repo\|template\|agent`) |

## Deploy

```bash
cd install-worker
npx wrangler d1 execute percolator-installs --remote --file=./migrations/0001_init.sql
npx wrangler secret put IP_HASH_SALT
npx wrangler deploy
# then attach custom domain install.percolator.tech (Workers Domains API)
```

## Ping snippet

```bash
curl -fsS -m 5 https://install.percolator.tech/i/skill.sh | bash || true
```
