# Verified build setup (solana-verify)

A verified build lets anyone rebuild the exact on-chain bytes from a tagged commit. This is set up and ready,
but **not yet run for mainnet** (there is no mainnet program).

## Tooling

- `solana-verify` v0.5.x: `cargo install solana-verify --locked` (installed on the build box).
- Docker. `solana-verify build` compiles inside `solanafoundation/solana-verifiable-build:<solana-version>`.
  The program depends on `solana-program = "1.18"`, so the script pins `:1.18.26`.
  **Docker is not installed on the agent box**, so the containerized build was not run here. Run it on a
  workstation or CI runner that has Docker.
- Script: `scripts/verify-build.sh {build|hash|onchain}`. It only builds and hashes; it never deploys.

## Mainnet flow (when dev signs off)

1. Generate the new mainnet program keypair offline. Write its pubkey to `program/program-id.txt` and commit.
   `build.rs` reads that file, and the build refuses the GM8z id.
2. Tag the audited commit, e.g. `v1.0.0-audit`.
3. `scripts/verify-build.sh build --mainnet` (no `devnet` or `small` features, so the production 4,096-account tier).
   Record `dist/verified-hash.txt`.
4. Deploy that exact `.so` (see MAINNET-CHECKLIST §3), then move the upgrade authority to Squads (SQUADS-MULTISIG-PLAN).
5. `scripts/verify-build.sh onchain <PROGRAM_ID>` must equal the hash from step 3.
6. Public verification (OtterSec registry / Solscan "verified" badge): `solana-verify verify-from-repo --remote
   -u mainnet-beta --program-id <PID> --library-name percolator_prog --mount-path program <REPO_URL> --commit-hash <TAG_SHA>`,
   then upload the PDA with `solana-verify export-pda-tx` signed by the **Squads** upgrade authority.

## Blocker to decide: private repo vs. public verification

`verify-from-repo` and the public verified-programs registry need a **publicly cloneable** repository. `clawd-market`
is private by design. Options:

- **A.** Publish a source-only mirror (program, engine and matcher only, at the audited tag) as a public repo right
  before mainnet. Recommended: users can verify, and the audit report can point to it.
- **B.** Stay private and verify only internally (local hash == on-chain hash). No public badge, and weaker trust for users.

## Devnet sanity check (done)

The devnet program `Anw121Fk3gKvUHXk938cY2xVb9Eq46WX3k15WESS49PA` was built with `cargo-build-sbf --tools-version v1.51
--arch v0 --features devnet,small` (not containerized). `scripts/verify-build.sh hash <so>` and `onchain <PID> devnet`
compare the local artifact with the deployed bytes.
