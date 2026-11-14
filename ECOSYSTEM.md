# Percolator Ecosystem — Solizardking Organization Map

**Status**: Educational / unaudited. Devnet/test chains only unless explicitly noted. No mainnet with real funds without further audit and owner approval.

This maps the related repositories under `@Solizardking` building on and around the open-source Percolator perpetual futures risk engine (original: [aeyakovenko/percolator](https://github.com/aeyakovenko/percolator), [aeyakovenko/percolator-prog](https://github.com/aeyakovenko/percolator-prog)).

## Core Protocol Layer

| Repo | Visibility | Language | Role |
|------|------------|----------|------|
| [percolator-prog](https://github.com/Solizardking/percolator-prog) | Private | Rust | Solana program wrapping the v16 account-local risk engine. Multi-asset slab markets, permissionless asset creation, insurance/backing isolation, marketauth governance. |
| [percolator](https://github.com/Solizardking/percolator) | Private | Rust + TS | TypeScript SDK + dark-percolator / MagicBlock Private Ephemeral Rollup experiments, aggregator adapters, engine mirror. |
| [percolator-cli](https://github.com/Solizardking/percolator-cli) | Private | TypeScript | CLI for interacting with markets (init, trade, crank, admin). Includes mainnet bounty market examples (STOXX/SOL etc.). |
| [percolator-stress-test](https://github.com/Solizardking/percolator-stress-test) | Private | Rust | Monte Carlo stress simulator for ADL fairness, haircuts, risk engine edge cases. |

## Product & Launch Layer

| Repo | Visibility | Language | Role |
|------|------------|----------|------|
| [percolator-launch](https://github.com/Solizardking/percolator-launch) | Private | TS + Rust | Full "Pump.fun for Perps" platform: Next.js frontend, Hono API, keeper, indexer, slab program tiers. Permissionless market launch for any token. |
| [percolator-tech](https://github.com/Solizardking/percolator-tech) | Private | HTML/JS | Official homepage + install tracker at [percolator.tech](https://percolator.tech). Markets proxy, skill/agent install counter, Cloudflare Worker + Render. |
| [percolator-ws](https://github.com/Solizardking/percolator-ws) | Private | TS + Python | WSS + paid MCP server (x402 USDC / $CLAWD holders). Read-only percolator_* tools; writes disabled. |

## Agent / Token Pairing Layer ($CLAWD ecosystem)

| Repo | Visibility | Language | Role |
|------|------------|----------|------|
| [percolator-agent-registry](https://github.com/Solizardking/percolator-agent-registry) | **Public** | Rust (Pinocchio) | On-chain registry pairing Metaplex Core agent assets with any SPL/Token-2022/pump/Raydium/Meteora/Percolator/Phoenix target. Clean-room, test chains only. |
| [percolator-mint](https://github.com/Solizardking/percolator-mint) | Private | JS | Browser minter for official Percolator agent (mpl-core + agent-registry). Live at [mint.percolator.tech](https://mint.percolator.tech). |
| [percolator-meta](https://github.com/Solizardking/percolator-meta) | Private | Rust | Non-custodial governance bootstrap: subledger (insurance operator), genesis-vote / residual-distributor, fixed-supply COIN distribution, Squads timelock handoff, TWAP buy/burn. |

## Related / Upstream

- **clawd-percolator** (public): Percolator perpetuals on Clawd Chain (test network, cUSD).
- Upstream originals: `aeyakovenko/percolator`, `aeyakovenko/percolator-prog`, `aeyakovenko/percolator-cli`, `aeyakovenko/percolator-match`, `aeyakovenko/percolator-stress-test`.

## Suggested Next Organization Steps

1. **Central index**: Add this file (or a shorter version) as `ECOSYSTEM.md` in `percolator-tech` and link it from the homepage.
2. **Visibility**: Consider making `percolator-agent-registry` and selected docs public; keep program/keys private.
3. **Monorepo option**: Group the core protocol crates under one workspace if dependency management becomes painful.
4. **Deploy status board**: Live links (mint.percolator.tech, percolator.tech, agent registry program IDs) in one place.
5. **License / disclaimer consistency**: All carry educational/unaudited disclaimers — keep that uniform.

All repos are under the authenticated Solizardking account. Most are private.
