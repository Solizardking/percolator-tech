# CLAWD Market: CLAWD perps on Percolator (devnet)

A hardened fork of [aeyakovenko/percolator-prog](https://github.com/aeyakovenko/percolator-prog) @02a4aef2 with
engine [aeyakovenko/percolator](https://github.com/aeyakovenko/percolator) @e22e30cf (Apache-2.0, see NOTICE).
It is the same single-file `no_std` Solana program and the same 1-byte-tag wire format. There is no Anchor.

**Collateral: CLAWD** `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`: the pump.fun CLAWD ("solanaclawd"), a Token-2022 mint
with 6 decimals and null mint and freeze authorities, graduated to the PumpSwap pool `GBzd5ooMFkYtYgzUMKfzyaEJpvzxvm5FK4FDJcpVJJcH`.

> **Unaudited. Devnet/localnet only.** See [SECURITY.md](SECURITY.md) and [docs/MAINNET-CHECKLIST.md](docs/MAINNET-CHECKLIST.md).

## What's different from upstream

* Two-step admin handoff (`UpdateAdmin` proposes, `AcceptAdmin` (tag 22) accepts), `security.txt`,
  and a build-time program id (GM8z refused).
* SPL Token **and Token-2022** collateral with a mint-extension allow-list.
* Upstream safety backports f40029b5 and 4673fef6. 3cdfa787 was reviewed: its invariant is kept and tested.
* **Permissionless user markets** on pump.fun curves, PumpSwap pools and Raydium LaunchLab / Stonk.fun pools,
  with a trustless in-program pool oracle (tags 23-25).
* `small` tier (256 accounts, 0.44 SOL rent).

Full list: [docs/HARDENING.md](docs/HARDENING.md). Design: [docs/USER-MARKETS.md](docs/USER-MARKETS.md).
Runs: [docs/DEVNET.md](docs/DEVNET.md).

## Layout

```
program/   on-chain program (src/percolator.rs, build.rs, program-id.txt, tests/)
engine/    risk engine (feature `small`)
matcher/   percolator-match @185ad0d (only for upstream integration tests)
client/    clawd_perps: Python client + CLI (detect venue, create market, trade; devnet default)
scripts/   build-devnet.sh, deploy.sh, smoke.py
docs/      hardening, user markets, mainnet checklist, devnet runs
```

## Build and test

```bash
cd program
cargo-build-sbf --tools-version v1.51 --arch v0          # production .so used by the LiteSVM tests
cargo test --release --test integration --test clawd_fork
cargo test --features test --test unit
cd ../client && python3 -m pytest -q tests
```

## Create a market (devnet)

```bash
cd client
python3 -m clawd_perps detect <MINT> --cluster mainnet          # read-only venue detection
python3 -m clawd_perps create-market <MINT> --collateral <CLAWD_DEV_MINT> --bond 2000000000 \
        --keypair ~/keys/creator.json [--invert] [--confirm]   # dry-run unless --confirm
python3 -m clawd_perps read-market <SLAB>; python3 -m clawd_perps quote <SLAB> --size 1000000
```

The client never sends mainnet transactions.
