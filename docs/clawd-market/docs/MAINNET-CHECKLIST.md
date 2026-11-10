# CLAWD market: mainnet launch checklist

Prepared so far (no sign-off needed, nothing deployed): [VERIFIED-BUILD.md](VERIFIED-BUILD.md) (solana-verify setup),
[SQUADS-MULTISIG-PLAN.md](SQUADS-MULTISIG-PLAN.md), [AUDIT-SCOPE.md](AUDIT-SCOPE.md), and
[MAINNET-RISK-PARAMS.md](MAINNET-RISK-PARAMS.md) (liquidity floors and leverage caps).

Nothing in this repo has been deployed to mainnet, and nothing should be until every box is checked.
This repo's tooling refuses to send mainnet transactions. Mainnet deployment is a deliberate manual step.

## 1. Oracle choice (most important)

- [ ] **Do not launch an admin-oracle market.** GM8z… markets use `SetOracleAuthority` + `PushOraclePrice`,
      so one hot key sets the mark price. That key can liquidate everyone or drain the LPs; it is a
      custodial price feed. In this fork the authority push remains available only for non-pool markets.
      If used at all, the authority must be a Squads multisig with a timelock, and `SetOraclePriceCap`
      must be at most 1%/update.
- [ ] Preferred for CLAWD: **pool oracle on the CLAWD/SOL PumpSwap pool** `GBzd5ooMFkYtYgzUMKfzyaEJpvzxvm5FK4FDJcpVJJcH`
      (kind 3, `invert=1`, CLAWD collateral, coin-margined). It is trustless, but the pool is thin (about $38k
      liquidity at review time). Mitigations already on-chain: 1%/slot clamp, EMA, 5x max (2x when thin),
      creator bond, pause and resolve on collapse. Before launch:
  - [ ] set `min_quote_liquidity` to at least 100 SOL of real liquidity, and IM at least 3,000 bps;
  - [ ] cap OI (`risk_reduction_threshold`) to a small fraction of pool depth;
  - [ ] run at least 2 independent keepers (`UpdatePoolPrice` + `KeeperCrank` every slot or two) with alerting;
  - [ ] model manipulation cost: moving the EMA by X% takes X slots of sustained pool skew, and that cost must exceed max profit at the OI cap.
- [ ] Pyth or Switchboard feed for CLAWD: none exists today. Re-evaluate before launch.

## 2. Slab size and rent

| tier | accounts | slab bytes | rent (approx.) |
|---|---|---|---|
| `small` | 256 | 62,984 | 0.44 SOL |
| production | 4,096 | 992,744 | 6.91 SOL |

- [ ] Pick the tier. Rent is locked in the slab and recoverable only via `CloseSlab` (needs zero accounts, zero vault, zero insurance).
- [ ] Pre-fund insurance (creator bond) in CLAWD.

## 3. Build and deploy hygiene

- [ ] New mainnet program keypair (never GM8z…, never the devnet `Anw121…`). Set `CLAWD_PROGRAM_ID`.
- [ ] Build **without** `devnet` and `test` features (the devnet feature swaps the LaunchLab program id).
- [ ] **Verified build**: `solana-verify build` (docker, pinned toolchain), then `solana-verify verify-from-repo`
      against a tagged commit. Publish the hash.
- [ ] `security.txt` contacts and policy URLs reachable. The repo is private, so either make the policy page
      public or point security.txt at a public page before launch.
- [ ] Deploy with a fresh deployer, then immediately transfer the **upgrade authority to a Squads v4 multisig**
      (`solana program set-upgrade-authority <PID> --new-upgrade-authority <SQUADS_VAULT>`). Consider
      making the program immutable after a bake-in period.
- [ ] Market admin to Squads: `UpdateAdmin(squads)` then `AcceptAdmin` executed from the multisig (two-step).
      For pool markets the admin can do very little; consider renouncing (zero) once stable.

## 4. Audit and testing

- [ ] External audit of the fork diff: Token-2022 path, pool oracle, two-step admin, settlement backport.
      The upstream base is also unaudited for this use.
- [ ] Re-run Kani proofs from upstream (`engine/`) and add proofs for `next_ema` and `ratio_e6` bounds.
- [ ] Fuzz `UpdatePoolPrice` and `ResolvePoolMarket` with adversarial pool accounts.
- [ ] Devnet soak: at least 1 week with real keepers and the devnet scripts (`scripts/smoke.py`).
- [ ] Bug bounty live before TVL.

## 5. Operations

- [ ] Monitoring: oracle staleness, paused flag, insurance vs bond, OI, liquidation backlog.
- [ ] Runbook for pool migration and collapse (ResolvePoolMarket, then users close, then WithdrawInsurance).
- [ ] Frontend shows: pool-oracle vs admin-oracle, leverage cap, bond, staleness, "unaudited".
