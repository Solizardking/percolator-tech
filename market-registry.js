// CLAWD Market (Solizardking/clawd-market) registry for percolator.tech.
// Single source of truth for the Render origin (app.js). The Cloudflare
// Worker keeps an identical copy in worker/src/clawd-markets.js because the
// Worker bundle only includes worker/src/ — keep the two in sync.
//
// Every address below comes from clawd-market's own docs (program-id.txt,
// docs/DEVNET.md, docs/runs/DEVNET-2026-11-09.md, app/README.md), vendored
// under docs/clawd-market/. Devnet / testnet only. Nothing here is mainnet.
// clawd-market is Apache-2.0; see docs/clawd-market/NOTICE for attribution.
export const CLAWD_MARKET = {
  name: 'CLAWD Market',
  summary:
    'Hardened Percolator fork with Token-2022 CLAWD collateral and trustless pump.fun / LaunchLab / PumpSwap pool oracles.',
  repo: 'https://github.com/Solizardking/clawd-market',
  license: 'Apache-2.0',
  status: 'unaudited — devnet only, nothing deployed to mainnet',
  docs: 'docs/clawd-market/README.md',
  devnet: {
    cluster: 'devnet',
    genesis: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    program: 'Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA',
    programData: 'GmoZckNT4hfcw22rdMdwG33EsUiNTXWdtw3m7Bd4s1Au',
    matcher: '4urzQCupvnMWvGTovGZsYSWNaGFA9WjsztBYEQJeNnAS',
    collateral: {
      name: 'CLAWD-dev (devnet stand-in for CLAWD)',
      mint: 'CTjhnHRb85g9m3LwZpfPKkoteKeFZcuX7VHfKeCVFxmW',
      tokenProgram: 'Token-2022',
      decimals: 6,
    },
    markets: [
      {
        name: 'CLAWD-dev admin-oracle market',
        oracle: 'admin-oracle (authority push; demo only — see docs/clawd-market/docs/MAINNET-CHECKLIST.md)',
        slab: '7KgTRxE14Rii5kR7YpPuCfKKQSceXoZNorhMtunRJDy3',
        vault: '9z7HcpxhgfZbGwgrLD72FtC6fsqSZwtvVYphWFCEA1ye',
      },
      {
        name: 'Permissionless PumpSwap pool-oracle market',
        oracle: 'kind 3 (PumpSwap reserves), invert 1, pow10 6',
        slab: '6GvLYn4qepjipw8E4cBHN2sXEQgXfKGDH9FLYqC9zzpU',
        vault: 'HuLkC41mcZ1ww8SmEpWLDd1RXq4JcgnRzggcm1fg3J9R',
        pool: 'DikcdxFFTZm9gRvnfSXY39hAp4iHcCNkp1bhsAZELHAQ',
        poolToken: '6YPxrB8XyRX5t4evWKhe5qnD78mYHAcv1dhqGy36xugn',
      },
    ],
  },
  design: {
    note: 'Mainnet design target only — NOT deployed. Gated on docs/clawd-market/docs/MAINNET-CHECKLIST.md.',
    collateralMint: '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump',
    collateralName: 'CLAWD (Token-2022, 6 decimals, null mint/freeze authorities)',
    pumpswapPool: 'GBzd5ooMFkYtYgzUMKfzyaEJpvzxvm5FK4FDJcpVJJcH',
  },
  services: {
    ws: {
      repo: 'https://github.com/Solizardking/percolator-ws',
      wss: 'wss://percolator.tech/ws',
      mcp: 'https://percolator.tech/mcp',
      reads: ['percolator_list_markets', 'percolator_read_market', 'percolator_oracle_price', 'percolator_quote', 'percolator_detect_venue'],
      writes: 'off (not registered; reserved names return x402 402)',
      access: 'reads free; $CLAWD holders free after SIWS; otherwise x402 USDC tiers',
    },
    auth: {
      upstream: 'https://percolator-auth-production.up.railway.app',
      basePath: '/api/auth',
      client: 'worker/src/auth-client.js',
      note: 'Better Auth on Railway + Neon; the Worker proxies /api/auth/* via env AUTH_UPSTREAM. See worker/AUTH.md.',
    },
    sdk: {
      repo: 'https://github.com/Solizardking/percolator',
      branch: 'claude/solana-perp-aggregator-ii3S5',
      note: 'TypeScript account decoders + oracle math for the slab layouts this program writes; read-only, signs nothing.',
    },
  },
};
