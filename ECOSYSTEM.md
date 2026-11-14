# Percolator ecosystem — repository roles and integration plan

Reviewed 2026-11-14 against the repository snapshots below. This is a source inventory and organization plan, not a deployment manifest or certification that the components work together.

## Start here

- **Product entry point and central documentation:** `percolator-tech`.
- **Launch/trading interface candidate:** `percolator-launch`.
- **Agent read interface:** `percolator-ws`, currently exposed at https://percolator.tech/mcp.
- **Shared read-side adapters:** the TypeScript workspace in `Solizardking/percolator`.
- **Agent onboarding and pairing:** `percolator-mint` plus `percolator-agent-registry`.
- **Protocol, operations and verification:** version-matched `percolator-prog`, `percolator-cli` and `percolator-stress-test`.
- **Optional governance:** `percolator-meta`.
- **Separate test-chain venue:** `clawd-percolator`, retained as a related component.

Keep the repositories separate for now. Pin and test their interfaces before moving code into a monorepo. No repository rename, visibility change, deployment, program upgrade or transaction is part of this organization pass.

## Repository inventory

Visibility was checked through GitHub on the review date. “Source present” is distinct from “deployed,” and recorded deployment claims are distinct from independently verified chain state.

| Repository | Visibility / default branch | Recommended ownership | Useful pieces | Integration limit |
|---|---|---|---|---|
| [percolator-tech](https://github.com/Solizardking/percolator-tech) | Private / main | Website, service directory, authentication entry point and ecosystem docs | Worker routes, market registry, Better Auth proxy, Privy JWT path, install tracking | Cloudflare Worker, Render origin/mirror and Railway auth are separate deployment surfaces; documentation is not a reliable current routing manifest |
| [percolator-ws](https://github.com/Solizardking/percolator-ws) | Private / main | MCP gateway and future live-feed transport | Five market/oracle/quote/venue reads, Node gateway, Python sidecar, SIWS/x402 access modules | Live MCP writes were disabled in this review; checked-in WebSocket server has status and optional simulated ticks, not a complete indexer/price feed |
| [percolator-agent-registry](https://github.com/Solizardking/percolator-agent-registry) | Public / master | On-chain agent-to-target relationship registry | Pinocchio program; TypeScript pair/unpair/primary/lock builders; owner and asset-signer authorization | Deployment record says Clawd Chain deployed, public Solana devnet pending, local devnet-state fork tested; no mainnet deployment recorded |
| [percolator-mint](https://github.com/Solizardking/percolator-mint) | Private / main | Agent creation and wallet-reviewed onboarding | Core asset/identity creation, executive/delegation flows, simulation, genesis validation, quote/review UI, metadata and Attributes mirror | Metaplex identity registration is separate from our pairing registry; metadata pairing is not an enforced registry relationship |
| [percolator](https://github.com/Solizardking/percolator) | Private / claude/solana-perp-aggregator-ii3S5 | Read-side SDK/adapters; isolated Dark Percolator research | Hybrid/v16/CLAWD slab decoders, oracle math, Pyth decoding, Phoenix REST adapter, prop-MM clients, dark-engine and Anchor program sources | This is not the upstream Rust crate named percolator; Dark Percolator README says not deployed, and SDK tests use synthetic bytes/mocked HTTP |
| [percolator-launch](https://github.com/Solizardking/percolator-launch) | Public / main | Launch, markets, trade, portfolio and earn UI | Next.js frontend/server routes, charts, wallet hooks, market-creation orchestration | External API/keeper/indexer and program dependencies; old README monorepo directories are absent; SDK/oracle migration must be resolved |
| [percolator-prog](https://github.com/Solizardking/percolator-prog) | Public / main | Versioned Solana wrapper source and invariants | v16 account-local wrapper, invariant tests, layout examples and Kani harness | Cargo pins the upstream engine to a specific revision; not automatically the source of either CLAWD deployment |
| [percolator-cli](https://github.com/Solizardking/percolator-cli) | Public / master | Operator tooling and reproducible smoke scenarios | v16 encoders/parsers, discovery, simulation flag, lifecycle/oracle scripts and deployment manifests | Historical bounty/mainnet examples target their own versions and authorities; do not reuse their program defaults as product configuration |
| [percolator-meta](https://github.com/Solizardking/percolator-meta) | Public / master | Optional governance research/integration | Insurance attribution, voting or residual distribution, fixed-supply allocation, Squads handoff, buy/burn auction | Experimental economics and authority model; not required for launch/trade and not an instruction to issue a new token |
| [percolator-stress-test](https://github.com/Solizardking/percolator-stress-test) | Public / master | Risk simulation and regression scenarios | Monte Carlo crashes, skew, funding, insurance, oracle lag and ADL/haircut scenarios | Cargo expects a sibling Rust engine named percolator with the stress feature; the SDK repository above does not satisfy that dependency |

## Highest-value reuse

### 1. Reuse the multi-layout read adapters

`percolator/src/lib/perps/aggregator/percolator/adapter.ts` already separates account fetching from decoding and exposes snapshots with mark source, oracle-leg source, slot, timestamp, insurance and open interest. This is a better starting point than duplicating raw byte offsets in the UI.

Candidate integration:
1. Pin the SDK commit.
2. Add recorded account fixtures for each supported deployed program.
3. Verify owner, layout generation, token decimals, quote units and inversion.
4. Normalize snapshots for Next.js and MCP consumers.
5. Keep prices unavailable when decoding or freshness validation fails.

The SDK README explicitly says its tests have not run against live chain data. Live compatibility remains a gate, not an established fact.

### 2. Reuse simulation and wallet review from the mint console

`percolator-mint/src/txsim.js` provides genesis-hash checks, transaction simulation, required-signer inspection, fee/CU estimates and watched-account lamport changes. `src/flows.js` provides identity, executive and delegation builders.

These are reusable patterns for transaction previews. They are not a universal transaction validator: address lookup table resolution, trading-specific account checks, slippage, token balance changes and versioned instruction decoding still need explicit handling.

### 3. Pair minted agents with markets without conflating identity and authority

The desired test-chain journey is:

1. Mint or select a Metaplex Core agent.
2. Read the current owner and selected network.
3. Build a pairing instruction for an allowlisted market/token target.
4. Simulate and request the owner's wallet signature.
5. Read the resulting pairing and primary pointer back.
6. Show whether the relationship is metadata-only, registry-recorded, primary or locked.

The pairing registry checks relationships; it does not itself grant trading authority or prove strategy performance. In the mint configuration, the official agent's token metadata points to $CLAWD. The open registry can support other target kinds without changing that product convention.

Registry source comments broadly mention devnet, but `DEPLOYMENTS.md` specifically distinguishes a local devnet-state fork from a public Solana devnet deployment. Use the more precise deployment record until chain evidence supersedes it.

### 4. Reuse the MCP read gateway, then build the actual streaming contract

During the 2026-11-14 review:
- MCP initialize and tools/list succeeded.
- The live catalog contained get_health plus five read tools.
- A devnet list-markets call returned two records under program `Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA`.
- Health reported writesEnabled=false and tradingEnabled=false.

This proves a working read path at that time, not executable trades, fresh oracle values, or a live WebSocket ingestion pipeline.

The checked-in `src/server.mjs` WebSocket transport supports status, ping/pong and optional simulated ticks. The launch UI expects market subscriptions and price/price.updated messages. Add real source ingestion and an adapter before presenting it as the launch app's live feed. Health counters initialized to constants must not be treated as measured ingestion quality.

### 5. Reuse operator and stress scenarios only after pinning their engine

`percolator-prog/Cargo.toml` pins:
`aeyakovenko/percolator@4db11a8cb0053815e23a35d3a7d3edc265d8d866`.

`percolator-stress-test/Cargo.toml` instead points to `../percolator` with feature `stress`. Putting the user's SDK repo in that folder does not supply the expected crate. Use a dedicated upstream-engine checkout or a reviewed explicit Git dependency, then adapt simulator APIs to the chosen revision.

The CLI has useful scenarios, but its checked-in historical manifests are evidence of earlier configurations, not verified current deployments. No operator or stress scripts were executed in this review.

## Keep the protocol families explicit

| Family | Source / identity | Routing rule |
|---|---|---|
| CLAWD pool-oracle slab | Related repository clawd-market; MCP currently reads devnet program Anw121…49PA | Use CLAWD slab decoder and matching instruction ABI; retain quote units and invert flag |
| Clawd Chain test perpetuals | Related clawd-percolator; wrapper 6Grr3eyu…Yhzx, separate test cUSD chain | Use its market/portfolio builders; fixed-price/house-wallet behavior must remain explicit |
| Upstream account-local v16 | percolator-prog and compatible CLI/engine revision | Bind to exact engine, wrapper, layout and matcher versions |
| Dark Percolator | percolator/programs/dark-percolator and crates/dark-engine | Experimental source; no deployed service inferred from a design or runbook |
| Agent pairing | percolator-agent-registry; test registry A5tHHrrX…3ADJm | Pairing identity is separate from market program identity and wallet execution authority |

`clawd-market` is a material dependency missing from the ten-repository list: the MCP Python venue identifies it as its program source, and the site integration document references its matcher/client/app. Keep it in the dependency inventory alongside `clawd-percolator`. Neither should be silently replaced by `percolator-prog`.

## Proposed shared contracts

These contracts are recommendations; this documentation change does not implement them.

| Contract | Required fields |
|---|---|
| Deployment identity | chain/genesis hash, RPC alias, program ID, source repo/commit, binary hash, layout ID, collateral mint/decimals, upgrade status |
| Market snapshot | deployment identity, market address, mark/index values as integer strings, units/scale, inversion, source slot/time, observed time, stale flag |
| Feed event | schema version, event type, deployment identity, market, sequence/cursor, source slot, observed time, simulation flag |
| Transaction plan | deployment identity, ABI revision, payer, required signers, exact instructions, simulation result, limits, expiry/blockhash, submission status |
| Agent relationship | chain, Core asset, current owner, target/program, registry/pairing address, flags, primary pointer, metadata-vs-registry provenance |
| Release evidence | pinned commits, fixture hashes, passing test commands/results, read-only smoke results, deployment receipts where applicable |

Serialize large integer amounts as decimal strings across JSON boundaries. Never merge markets by ticker alone: network, program and market address are part of identity.

## Service ownership

| Surface | Owner | Separation to preserve |
|---|---|---|
| Homepage, docs, ecosystem index, install stats | percolator-tech | Worker edge routes versus Render origin/install storage |
| /api/auth and login sessions | percolator-tech/auth-server plus Worker proxy | Site login does not replace wallet signing or MCP payment/holder access |
| /mcp | percolator-ws | Node access gateway plus Python tool sidecar |
| WebSocket market events | percolator-ws, after implementation | Transport uptime versus actual source freshness |
| Launch/trade UI | percolator-launch as integration candidate | Version-specific transactions and test-chain venues |
| Agent mint console | percolator-mint | Metaplex identity, optional delegation, and our separate pairing registry |
| Pairing state | percolator-agent-registry | Registry ownership does not imply custody or trade authority |
| Governance lifecycle | percolator-meta | Optional authority/economics layer, not a default dependency |

The current site docs describe Cloudflare, Render and Railway paths and a separate public mirror for an origin deployment. Verify actual routing before changing DNS or production bindings. Existing documents include stale “staged, not merged” language even though the integration files are present on main.

## Sequenced integration backlog

| Priority | Work | Completion evidence |
|---|---|---|
| P0 | Record the selected chain/program/layout/commit matrix | Every supported market resolves to one decoder and transaction ABI |
| P0 | Resolve SDK-versus-Rust-engine naming and dependency ambiguity | Clean wrapper/simulator build against the intended pinned engine |
| P0 | Normalize SDK/MCP market snapshots | Same fixture produces matching prices, units, OI and insurance in both clients |
| P0 | Replace simulated/status-only feed assumptions | Real subscription emits timestamped events; reconnect/staleness tests pass |
| P1 | Connect launch UI to selected read API and matched transaction builder | One test-network create/deposit/trade/close/withdraw journey with receipts |
| P1 | Add agent identity and registry pairing screens | Simulated + signed test-chain pairing, readback, transfer/primary/lock cases |
| P1 | Reconcile Worker/origin/auth/MCP deployment ownership | Route matrix checked against live responses and deployment source |
| P2 | Package common read/simulation utilities | Versioned imports replace copied implementations; compatibility tests pass |
| P2 | Port and rerun risk stress scenarios | Results tied to engine SHA, parameters and reproducible seeds |
| P3 | Evaluate meta governance and Dark Percolator separately | Explicit requirements, version matching and independent validation |

## Review snapshots and source references

The following are source snapshots, not a claim that their commits are deployed:

| Repository | Reviewed commit |
|---|---|
| percolator-tech | b7c777ba84a7e129d477ab6900eaace5cf54fde6 |
| percolator-ws | 82c02cb9d7c2da80fe9c68e9016815426bfa9ca1 |
| percolator-agent-registry | 834f53911464697cc2711eeb7a6c58bd07f04a1d |
| percolator-mint | f849588f83f9304fa416535c8a2bb6e3f14eea1f |
| percolator | 7719160efd9275d88755b4c36e1cabcfd14ce153 |
| percolator-launch | d3e105ecf2feacf5ab0471e22a3d1d993bcc98d1 |
| percolator-prog | 5cb331dde354517c6371a8acf92cecb194f3bb73 |
| percolator-cli | 7f9004768e5f6cbc4fb8c08fc1e5a8751669d990 |
| percolator-meta | 87ea552620508ab0f766a82a70ec2e385d7fad0b |
| percolator-stress-test | 9aaca144dae7d826ee9fbe6699eecb9955a1290c |

Key evidence:
- [Site integration document](docs/INTEGRATION.md), [Worker routes](worker/src/worker.js), [auth source](auth-server/).
- [SDK adapter](https://github.com/Solizardking/percolator/blob/7719160efd9275d88755b4c36e1cabcfd14ce153/src/lib/perps/aggregator/percolator/adapter.ts), [SDK workspace](https://github.com/Solizardking/percolator/blob/7719160efd9275d88755b4c36e1cabcfd14ce153/Cargo.toml).
- [MCP and WS transport](https://github.com/Solizardking/percolator-ws/blob/82c02cb9d7c2da80fe9c68e9016815426bfa9ca1/src/server.mjs).
- [Mint simulation](https://github.com/Solizardking/percolator-mint/blob/f849588f83f9304fa416535c8a2bb6e3f14eea1f/src/txsim.js), [mint identity/token configuration](https://github.com/Solizardking/percolator-mint/blob/f849588f83f9304fa416535c8a2bb6e3f14eea1f/src/agent-config.js).
- [Pairing deployment record](https://github.com/Solizardking/percolator-agent-registry/blob/834f53911464697cc2711eeb7a6c58bd07f04a1d/DEPLOYMENTS.md).
- [Wrapper engine pin](https://github.com/Solizardking/percolator-prog/blob/5cb331dde354517c6371a8acf92cecb194f3bb73/Cargo.toml), [stress-test dependency](https://github.com/Solizardking/percolator-stress-test/blob/9aaca144dae7d826ee9fbe6699eecb9955a1290c/Cargo.toml).
- [Meta governance modules](https://github.com/Solizardking/percolator-meta/blob/87ea552620508ab0f766a82a70ec2e385d7fad0b/README.md).

Scope: repository metadata, README/source/manifests and selected read-only MCP checks. No compilation, stress run, financial transaction, deployment, DNS change or authority change was performed for this organization pass. Tests and historical receipts in repositories are recorded evidence, not tests rerun here.
