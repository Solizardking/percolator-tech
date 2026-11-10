# Hardening log (CLAWD fork of percolator-prog@02a4aef2 + percolator@e22e30cf)

The base is the program GM8z… runs (prog 02a4aef2, engine e22e30cf). 2,931 upstream prog commits
landed after it; most target the later v10.5 ADL engine and do not apply. Each safety-relevant one
was reviewed:

| Upstream | What it fixes | Status here |
|---|---|---|
| f40029b5 (2026-02-12) "Fix Bug #12: WithdrawInsurance must decrement engine.vault" | vault accounting drift after insurance withdraw | **Backported** (commit a7a5db8) |
| 4673fef6 (2026-02-15) "Harden limited insurance withdraw defaults…" | resolved markets must settle at the fixed settlement price | **Backported** the settlement-price half: Withdraw, LiquidateAtOracle, CloseAccount use `authority_price_e6` once resolved; AdminForceClose always does. Its limited-insurance tags 22/23 were *not* taken (tag numbers are reused by AcceptAdmin/UpdatePoolPrice here). |
| 3cdfa787 (2026-03-16) "Fix AdminForceCloseAccount c_tot underflow, remove double decrement" | c_tot decremented twice on force close | **N/A at 02a4aef2**: the double-decrement path is in the ADL engine. Invariant kept explicitly (c_tot changes only through `set_capital`), loss path uses `pnl.unsigned_abs()`, regression test `resolved_market_settles_at_fixed_price_and_force_close_keeps_c_tot`. |
| 7dfa0b49, 4be55ab6 (2026-03-16), d47fee10 (2026-03-17) | force-close / CloseAccount fixes and offsets for the ADL engine | N/A (ADL-only code paths and offsets) |
| d00c67e3, 81b7c619 (2026-02-18) | per-market admin limits + audit gaps | N/A (feature not present at base). The pool-market lock below is the stricter equivalent for user-created markets. |

## Fork additions

1. **Two-step admin handoff.** `UpdateAdmin` (tag 12) now only *proposes* (`pending_admin`);
   `AcceptAdmin` (tag 22) must be signed by the proposed key. Proposing the current admin cancels.
   Proposing the zero key is an explicit, immediate renounce. Error codes 28/29.
2. **security.txt** via `solana-security-txt` (excluded under `no-entrypoint`).
3. **Configurable program id.** `build.rs` reads `$CLAWD_PROGRAM_ID` or `program/program-id.txt`
   and refuses the GM8z id; devnet id `Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA`.
4. **Token-2022 collateral** (CLAWD is Token-2022): manual mint/account unpacking (82-byte base,
   account-type byte at 165, TLV from 166) and plain `Transfer` CPI to whichever token program owns
   the mint. Mint-extension allow-list: MetadataPointer/TokenMetadata/GroupPointer/Group/
   GroupMemberPointer/GroupMember (18-23) and MintCloseAuthority (3). Everything else is refused
   (TransferFee, PermanentDelegate, TransferHook, ConfidentialTransfer, NonTransferable, Pausable,
   DefaultAccountState…) with `UnsupportedMintExtension` (36).
5. **Owner consistency.** Vault, user token accounts and token program must agree
   (`vault.owner == mint.owner`, source/dest owned by the passed token program).
6. **Pool oracle + user-created markets** (tags 23-25), see [USER-MARKETS.md](USER-MARKETS.md):
   in-program reserve reads, one update per slot, <=1%/slot clamp, EMA (alpha <= 50%), staleness,
   liquidity floor, leverage cap tied to liquidity, creator bond, every admin lever locked, insurance
   locked until all accounts close, permissionless resolve on migration or sustained collapse.
7. **Size tiers.** Engine feature `small` (256 accounts, 62,984-byte slab, about 0.44 SOL rent)
   for devnet and community markets; production stays 4,096 accounts (992,744 bytes, about 6.91 SOL).

## Wire and layout compatibility

* Tags 0-21 keep their encodings. **Tag 12's meaning changed** (propose, not transfer).
* `MarketConfig` grew from 320 to 496 bytes (new fields appended), so `ENGINE_OFF` moved
  392 -> 568 and the slab grew by 176 bytes. Every GM8z-era config field keeps its offset.
  Existing GM8z slabs are **not** binary-compatible with this program. Deploy fresh.

## Test results (2026-11-09)

| Suite | Result |
|---|---|
| upstream `integration` (LiteSVM, production .so) | 450 passed, 0 failed, 1 ignored (baseline was 450/450; 9 tests updated for the new offsets and two-step admin) |
| `clawd_fork` (new) | 13 passed |
| `unit` (`--features test`) | 34 passed |
| `i128_alignment` + `cu_benchmark` | 1 + 8 passed |
| engine (`cargo test --release`) | 96 passed |
| `client/tests` (pytest) | 7 passed |
| localnet end-to-end (`scripts/smoke.py`, devnet build) | admin-oracle, PumpSwap (CLAWD) and pump-curve markets all passed; see `docs/runs/` |
