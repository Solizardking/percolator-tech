# Permissionless user perps markets (pump.fun, PumpSwap, Raydium LaunchLab, Stonk.fun)

Anyone can paste a token mint and open a CLAWD Percolator perps market on it. The creator becomes the
market admin, but on a pool market **every admin price lever is locked**: the index comes only from
pool reserves read inside the program.

## Flow

```
paste mint -> detect venue -> eligibility (liquidity, migration, leverage cap)
  -> ONE atomic tx: create slab | create vault ATA (vault PDA = ["vault", slab])
                    | InitMarket(index_feed_id = pool pubkey, invert, risk params)
                    | ConfigurePoolOracle(kind, pow10, min_liq, bond, ema_alpha)
                    | TopUpInsurance(bond)
  -> keepers call UpdatePoolPrice (permissionless) -> users InitUser/Deposit/Trade/Withdraw
```

Doing it in one tx means nobody, including the creator, ever sees the market in an
admin-oracle state. Clients should still check `pool.kind != 0` before trading (`read-market`).

## Venues and on-chain layouts (checked against live mainnet accounts)

| kind | venue | account read | price (quote per base) | liquidity used for guards | migrated when |
|---|---|---|---|---|---|
| 1 | pump.fun bonding curve (`6EF8rrec…F6P`) | BondingCurve PDA `["bonding-curve", mint]`, disc `17b7f83760d8ac60`; vt@8 vs@16 rt@24 rs@32 complete@48 | vs / vt | real SOL `rs` | `complete != 0` |
| 2 | Raydium LaunchLab (`LanMV9sA…3uj`), used by Stonk.fun | PoolState disc `f7ede3f5d7c3de46`; status@17 vb@37 vq@45 rb@53 rq@61 base_mint@205 quote_mint@237 vaults@269/301 creator@333 | (vq+rq) / (vb−rb) | real quote `rq` | `status != 0` |
| 3 | PumpSwap (`pAMMBay6…EXA`) | Pool disc `f19a6d0411b16dbc`; base_mint@43 quote_mint@75 base_vault@139 quote_vault@171, plus both vault token accounts | quote_vault.amount / base_vault.amount | quote vault amount | n/a (pool resolves on collapse) |

`price_e6 = quote * 10^(6+pow10) / base`, then optional `invert` (1e12/p, coin-margined markets)
and `unit_scale`. The client picks `pow10` so the integer price keeps at least 6 significant digits.
Checks: the pool owner must be the venue program, `index_feed_id` must equal the pool,
pump-curve PDA re-derived from the passed mint, base_mint must match, and PumpSwap vaults must be
the pool's own and owned by a token program.

## Guards (on-chain, `pool_oracle` module)

* **Smoothing:** one observation per slot (repeat calls are no-ops), spot is clamped to at most
  1%/slot (`MAX_CAP_E2BPS`) toward the EMA, then `EMA += alpha·(clamped−EMA)`, alpha <= 50%.
* **Staleness:** trades and withdrawals refuse an index older than `max_staleness_secs`, so a keeper must run.
* **Minimum liquidity:** `min_quote_liquidity >= 1e6` base units. Below it the market sets PAUSED and trades stop.
* **Leverage cap tied to liquidity:** initial margin at least 20% (5x). If liquidity is under 10x the floor, at least 50% (2x).
* **Creator bond:** `min_insurance_units >= 1e6`. Trades are refused until insurance >= bond, and the create flow funds it in the same tx.
* **Admin levers locked:** SetRiskThreshold, UpdateConfig, SetMaintenanceFee, SetOracleAuthority,
  PushOraclePrice, SetOraclePriceCap and ResolveMarket all return `PoolOracleLocked` (31).
* **No insurance drain:** WithdrawInsurance on a pool market needs the market resolved **and**
  zero open accounts.
* **Auto-resolve:** `ResolvePoolMarket` (tag 24) is permissionless, but only when the pool migrated, the
  pool account is gone, or liquidity stayed under the floor for at least 9,000 slots (about 1h). It
  settles at the program's EMA, never at a creator-chosen price.
* **Collateral:** SPL or Token-2022 without dangerous extensions. Stonk.fun tokens with transfer fees
  (`transferFee.bps`, e.g. 300) **can be an index** but **cannot be collateral**.

Not supported yet: graduated LaunchLab tokens (Raydium CPMM). Their markets resolve on migration. A CPMM
reader is the planned `kind 4`.

## Stonk.fun API (https://stonkfun.xyz/developers, OpenAPI at `/api/public/v1/openapi.json`)

**No API key** is required. Limits are per IP: about 300 req/min on v1 and 240 req/min on v2.

| Endpoint | Fields used | Where |
|---|---|---|
| `GET /api/public/v1/tokens/{mint}` | `mint`, `pool`, `launchpad` (raydium/launchlab/pump), `status`, `quote.mint`, `quote.symbol`, `transferFee.bps`, `feeModel` | `client/clawd_perps/venue.py` detection (mainnet) |
| `GET /api/public/v1/tokens?status=&quoteMint=&sort=&pageSize=` | same per-token fields, `market.priceUsd`, `graduationProgress` | clawd-ws tape tagging, discovery |
| `GET /api/v2/launches/recent?limit=&cursor=` | `mint`, `pool`, `launchpad`, `quote` | clawd-ws tape (new Stonk launches) |
| `GET /api/public/v1/stats` | `config.launchLabEnabled` (true), `config.pumpLaunchesEnabled` (false) | venue gating |
| `GET /api/public/v1/pairs?launchable=true&launchLabReady=true` | `quote.mint`, `tokenProgram`, `decimals` | quote-token decimals and Token-2022 detection |
| `GET /api/public/v1/launchlab/pricing?quoteMint=` | `curve.programId`, `curve.configId`, `curve.supply`, `curve.totalSellA`, `curve.derived.virtualA/B`, `raise.raw`, `platform.*` | used to verify the LaunchLab decoder (`launchlab_pool_oracle_matches_stonkfun_price`) |
| `GET /api/public/v1/launchlab/platforms` | platform config ids | verification |

Stonk launches often quote in non-SOL assets (xStocks like SPYX, or ZEC). Detection tries the Stonk
`quote.mint` first, then WSOL and USDC, for the LaunchLab pool PDA `["pool", mint, quote]`.

## Web/API spec (for clawd-ws and the Imperial MCP venue)

```
GET  /perps/markets                  -> [{slab, mint, venue, kind, pool, ema_price_e6, oi, insurance, paused, resolved}]
GET  /perps/markets/{slab}           -> decoded slab (client/clawd_perps/layout.py decode_slab)
GET  /perps/eligibility/{mint}       -> {venue, kind, pool, eligible, reason?, max_leverage, transfer_fee_bps}
GET  /perps/oracle/{slab}            -> {ema_price_e6, last_update_slot, last_liquidity, paused, migrated}
POST /perps/markets {mint, collateral_mint, bond, im_bps, invert, cluster="devnet", confirm=false}
     -> unsigned tx (base64) + slab keypair pubkey; server never holds user keys; confirm=false = simulate only
WS   events: perps.market_created, perps.oracle_price, perps.open_interest, launch.perps_eligible
```

Mainnet is read-only in every client. `create` defaults to devnet, and sending needs explicit confirmation.

## What was mocked / stand-ins

* **Devnet LaunchLab:** the devnet build expects owner `DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6`.
  It is executable on devnet but not verified to be LaunchLab, and there are no Stonk launches on devnet.
  LaunchLab is therefore covered by LiteSVM tests on a real mainnet PoolState snapshot.
* **Localnet end-to-end** (`docs/runs/*.json`): real mainnet accounts cloned read-only into
  `solana-test-validator` (CLAWD mint, CLAWD/SOL PumpSwap pool and vaults, a live pump curve). The
  collateral is a freshly minted **CLAWD-dev** Token-2022 stand-in (6 decimals). Prices are frozen at the
  clone slot because nobody swaps on localnet.
* **LP side** of trades uses `TradeNoCpi`, with a second keypair as LP. The vAMM matcher (`percolator-match`)
  is only used in the upstream integration suite.
