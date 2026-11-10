# Devnet / localnet runs

## Status (2026-11-09)

* **Devnet: deployed and passed** (2026-11-09) over a Helius devnet RPC. Program
  `Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA`. Both the CLAWD-dev admin-oracle market and a permissionless
  PumpSwap pool-oracle market ran end to end. See [`runs/DEVNET-2026-11-09.md`](runs/DEVNET-2026-11-09.md) for
  addresses and Solscan links. Cost: about 1.40 SOL programdata rent (the buffer is refunded) plus about 0.32 SOL per small slab.
* **Localnet: passed** with the exact devnet build (`--features devnet,small`, program id
  `Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA`). `solana-test-validator` was run with the SIMD-0500
  feature deactivated to match devnet, plus read-only clones of mainnet accounts. Signatures are in
  `docs/runs/smoke-localnet-*.json`. They are localnet signatures, not on any public cluster.

## Run on devnet once funded

```bash
# keys live outside the repo (never commit them): /workspace/clawd-keys/{program,deployer,admin,user,lp}.json
cp .env.example .env && $EDITOR .env    # HELIUS_DEVNET_RPC_URL (or CLAWD_RPC); .env is gitignored
set -a; . ./.env; set +a
scripts/build-devnet.sh                                   # -> dist/clawd_percolator_devnet_small.so
CLAWD_SO=dist/clawd_percolator_devnet_small.so scripts/deploy.sh devnet   # checks genesis = devnet, prints rent first
python3 scripts/smoke.py --cluster devnet --out docs/runs/smoke-devnet.json
# pool market on a live devnet PumpSwap pool, reusing the CLAWD-dev collateral mint from the first run:
python3 scripts/smoke.py --cluster devnet --collateral-mint <CLAWD_DEV_MINT> \
  --pool-mint 6YPxrB8XyRX5t4evWKhe5qnD78mYHAcv1dhqGy36xugn --pool-min-liquidity 10000000
```

## Localnet reproduction

```bash
solana-test-validator --reset --url https://api.mainnet-beta.solana.com \
  --deactivate-feature B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g \
  --clone 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump --clone GBzd5ooMFkYtYgzUMKfzyaEJpvzxvm5FK4FDJcpVJJcH \
  --clone 5Qz51i5YX3yEueB2nioNCbNfueT3ESPg3Mm5ZvTVshDX --clone 6izodPxXGcm5289cMHxTVSAUF1yh8juzfDm7PgPu5qa6 \
  --clone HJGSRvxgtbzXVV5yE44ZH8zYCqUT9MTBpx6FJfWjdeVV --clone 22JtjLcyUmSU7Y8BF896T8jUWPnqABZXrKWLWBqMpump
scripts/deploy.sh localhost
python3 scripts/smoke.py --cluster localnet --pool-mint 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump --pool-min-liquidity 1000000000
```

Note: oracle pushes use the cluster clock (`getBlockTime`), not wall-clock time. A future timestamp makes the
authority price invalid, and the program then falls back to the oracle account (`IllegalOwner`).
