# Percolator stack integration map — percolator.tech

Branch: `integrate/clawd-market` (from `main` @ 56caac16). Status: **staged, not merged,
not deployed.** Everything here is devnet / Clawd Chain testnet. No mainnet, no signing,
no keys anywhere in this integration.

## The pieces

| Repo / service | What it is | Role in the site |
|---|---|---|
| `Solizardking/percolator-tech` (this repo) | percolator.tech: Render origin (`server.js`/`app.js`, home + installs + `/api/markets` proxy) + Cloudflare Worker (`worker/`: `/feed`, legal pages, `/api/auth` proxy, Privy `/api/me`) | Integration target |
| `Solizardking/clawd-market` @ fcc90194 | CLAWD perps market: hardened Percolator fork (Apache-2.0), Token-2022 CLAWD collateral, trustless pool oracles. Devnet program `Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA` | Market layer (below) |
| `Solizardking/percolator` @ `claude/solana-perp-aggregator-ii3S5` | TypeScript SDK: slab decoders (hybrid/v16/CLAWD-fork), Pyth `PriceUpdateV2`, oracle math; Phoenix/prop-mm clients; dark-perps design (no program deployed) | Read-side decoding for market data (below) |
| `Solizardking/percolator-ws` @ 92bfdd7b | WSS + paid MCP for percolator.tech: `percolator_*` reads free / x402 / SIWS holder access; write tools **not registered**; Python sidecar vendors `clawd_perps` from clawd-market's client | Live feed + agent API (below) |
| `percolator-auth-production.up.railway.app` | Better Auth (Railway service `percolator-auth` + Neon Postgres), source in `auth-server/` | Accounts: site `/api/auth/*` (below) |

## clawd-market → percolator.tech (component by component)

| clawd-market component | Lands at | How |
|---|---|---|
| `program/` (on-chain program, devnet `Anw121…49PA`, ProgramData `GmoZckNT…s1Au`) | `/market` page + `/api/clawd-markets` | Addresses published in the registry (`market-registry.js` / `worker/src/clawd-markets.js`). The program itself stays in clawd-market; the site never deploys programs. |
| Devnet markets (2026-11-09 run) | `/market` + `/api/clawd-markets` | Market A admin-oracle slab `7KgTRxE1…JDy3`; Market B PumpSwap pool-oracle slab `6GvLYn4q…zzpU`, pool `DikcdxFF…ELHAQ`. Full tx record vendored at `docs/clawd-market/docs/runs/DEVNET-2026-11-09.md`. |
| `matcher/` + devnet matcher program `4urzQCup…NnAS` | `/api/clawd-markets` | Listed in the registry (LP `TradeCpi` path used by the app). |
| `engine/` (risk engine, Kani proofs) | `docs/clawd-market/` + `/proofs` (existing) | Engine audit/spec stay canonical in clawd-market; the site's proofs page already tracks the Clawd Chain engine snapshot. |
| `app/` (React+Vite trading UI + RPC-proxy server) | **Decision needed** (see Open decisions) | Not hosted yet. The app is a separate Vite build + Node server (`/rpc`, `/rpc/mainnet` read-only, `/api/stonk/:mint`); the site's Worker Assets bundle is a different Vite app. Options in Open decisions. Until then `/market` links it as a local run. |
| `client/` (`clawd_perps` Python CLI) | percolator-ws sidecar + docs | Already vendored inside percolator-ws (`python/clawd_perps/`); its Web/API spec (`docs/USER-MARKETS.md` §"Web/API spec") is the contract the ws/MCP tools implement (`/perps/markets`, `/perps/eligibility/{mint}`, `/perps/oracle/{slab}`). |
| `docs/` (HARDENING, USER-MARKETS, DEVNET, MAINNET-CHECKLIST, VERIFIED-BUILD, SECURITY) | `docs/clawd-market/` in this repo | Vendored verbatim on this branch, layout preserved so cross-links resolve. `AUDIT-SCOPE.md`, `MAINNET-RISK-PARAMS.md`, `SQUADS-MULTISIG-PLAN.md` and `docs/runs/*.json` remain canonical in clawd-market (linked from `/market`). |
| `LICENSE` + `NOTICE` (Apache-2.0) | `docs/clawd-market/LICENSE`, `docs/clawd-market/NOTICE` | Vendored verbatim. Attribution also on the `/market` page footer. |
| `scripts/` (build/deploy/smoke) | — | Operator-side only; deliberately not part of the site. Deploy keys never touch this repo or any host here. |
| `tools/patch*.py` | — | Fork-construction history; stays in clawd-market. |

Existing site markets are untouched: `/api/markets` still proxies the Clawd Chain
registry (wrapper `6Grr3eyu…Yhzx`, stake `85rgQvJs…fXk5q`, NFT `GDaUkuhb…6nHLR`;
SOL/BTC/ETH/CLAWD-PERP) and `/trade` + `/stake` still serve the Clawd Chain app.
`/api/clawd-markets` is a separate, additive registry for the clawd-market devnet stack.

## percolator (SDK) wiring

- The SDK's CLAWD-fork slab decoder is the read path for turning `/api/clawd-markets`
  slab addresses into live decoded market state (EMA price, OI, insurance, paused).
  Integration point when the ws sidecar or a Worker cron needs slab state: consume the
  SDK from its repo branch `claude/solana-perp-aggregator-ii3S5` — do not copy its
  sources into this repo while that branch is in flight.
- Phoenix / prop-mm adapters and the `dark/` designs (Helius Privacy Rings, MagicBlock
  PER) are research surfaces only: no program is deployed, nothing is linked from the
  public site beyond this map.

## percolator-ws wiring

- Endpoints (per its README deploy plan, DNS lands the service on the percolator.tech
  host): `wss://percolator.tech/ws` (status + market ticks) and
  `https://percolator.tech/mcp` (Streamable HTTP MCP).
- Tools: `percolator_list_markets`, `percolator_read_market`, `percolator_oracle_price`,
  `percolator_quote`, `percolator_detect_venue` — free reads; $CLAWD holders free after
  SIWS (`POST /auth/siws/challenge` + `/verify` → 1h Bearer); otherwise x402 USDC tiers
  via `https://musebook.trade/api/x402`. Write tools are not registered; reserved names
  return 402. The service refuses to boot if a devnet keypair or trading flag is set —
  keep it that way on the public host.
- The `/market` page publishes these endpoints; the registry JSON carries them under
  `services.ws` so agents can discover them from `/api/clawd-markets`.
- Deploy (owner step, from the ws README): Railway Dockerfile service with
  `MCP_AUTH_SECRET` (24+ chars), `SOLANA_RPC_URL`, optional `MCP_X402_*` /
  `PERCOLATOR_*_RPC_URL`; confirm the SIWS domain text matches `percolator.tech`.

## Auth wiring (do not forget)

- Upstream: `https://percolator-auth-production.up.railway.app` (Better Auth,
  `baseURL https://percolator.tech`, `basePath /api/auth`, Neon Postgres, Sentinel in
  log/challenge mode). Verified live 2026-11-10: `GET /health` → 200,
  `GET /api/auth/ok` → `{"ok":true}`.
- Site side is already built on `main`: `worker/src/auth.js` proxies `/api/auth/*` to
  `env.AUTH_UPSTREAM`; `worker/src/auth-client.js` is the browser client
  (`baseURL https://percolator.tech`, `basePath /api/auth`, `sentinelHeaders: "modern"`).
- **Deploy-time requirement:** the live Worker must carry the plain-text binding
  `AUTH_UPSTREAM = https://percolator-auth-production.up.railway.app` (no path).
  Without it `/api/auth/*` returns 503 "auth is not configured". Never put
  `BETTER_AUTH_SECRET` / `BETTER_AUTH_API_KEY` on the Worker — Railway only.
  Full runbook: `worker/AUTH.md`. This branch does not change any auth code.
- `/api/me` (Privy JWT check) is a separate, pre-existing path and is unchanged.

## What this branch changes

- `docs/INTEGRATION.md` — this map.
- `docs/clawd-market/**` — clawd-market LICENSE, NOTICE, SECURITY.md, README.md and
  docs (HARDENING, USER-MARKETS, DEVNET, MAINNET-CHECKLIST, VERIFIED-BUILD,
  runs/DEVNET-2026-11-09) vendored verbatim (Apache-2.0 attribution intact).
- `market-registry.js` (new) — registry data module for the Render origin.
- `worker/src/clawd-markets.js` (new) — same registry + response handler for the Worker.
- `public/market.html` (new) — the `/market` page.
- `app.js` — serves `/market` and `GET /api/clawd-markets` (registry) on the Render origin.
- `worker/src/worker.js` — routes `/api/clawd-markets`, maps `/market` → `/market.html`
  in Workers Assets, adds the Market nav link.
- `README.md` — route list updated.

## Merge / deploy steps (owner go-ahead required)

1. Review the branch diff on GitHub (two files were rewritten via the API —
   `app.js` and `worker/src/worker.js`; the branch-vs-main diff was verified to contain
   only the insertions listed above, and all JS passed `node --check` / parse checks).
2. Merge `integrate/clawd-market` → `main`.
3. Render origin: the live service still deploys from
   `themusebook/x402-messaging@percolator-tech-site` (Render cannot read this private
   repo) — mirror the merge there, or grant Render access to this repo and switch the
   service repo, then redeploy. `MARKETS_URL` is unchanged.
4. Worker: script-only update per the `wrangler.toml` warning — update the Worker code
   (new `worker.js` + `clawd-markets.js`) while keeping the existing ASSETS bundle and
   all secret bindings (Privy, `GITHUB_TOKEN`); add `/market.html` to the Assets bundle
   (it is `public/market.html` here; the live Vite app bundle needs the same file) and
   set `AUTH_UPSTREAM` if not already set (above).
5. Smoke after deploy: `GET /api/health` 200, `GET /api/clawd-markets` returns the
   registry, `GET /market` renders, `GET /api/auth/ok` → `{"ok":true}` through the
   proxy, existing `/api/markets` + `/feed` unchanged.

## Open decisions for the dev

1. **Trading app hosting** (`clawd-market/app`): (a) second Render service on a
   subdomain (e.g. `app.percolator.tech`) running `app/server/index.mjs` + its Vite
   build — cleanest, keeps its RPC-proxy semantics; (b) fold its build into the Worker
   Assets Vite app and re-implement `/rpc` + `/api/stonk` in the Worker — more work,
   one bundle; (c) leave local-only and keep `/market` as the registry/docs surface.
   Recommendation: (a).
2. **percolator-ws hosting**: Railway service + DNS per its README (step above), or a
   subdomain (`ws.percolator.tech`) if the apex stays on Cloudflare/Render. Its README
   assumes the apex points at Railway, which conflicts with the current
   Cloudflare-fronted setup — pick the host before wiring DNS.
3. **Vendored-docs drift**: `docs/clawd-market/` is a snapshot of clawd-market
   @ fcc90194. Re-vendor on clawd-market releases, or replace with links only.
4. **Public verification blocker** (from VERIFIED-BUILD.md): verified-build public
   registry needs a publicly cloneable source mirror before any mainnet step — mainnet
   remains gated on the whole MAINNET-CHECKLIST regardless.
