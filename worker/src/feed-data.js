/**
 * Edge-safe feed data for percolator.tech Workers.
 * Live: GitHub commits/Actions (public API), on-chain program probes.
 * Snapshot: Kani counts + keeper/oracle pids from /ops-snapshot.json (static asset).
 * No secrets, no diffs, no client-side GitHub token.
 */
const CLAWD_RPC = 'https://rpc.clawdchain.trade';
const DEVNET_RPC = 'https://api.devnet.solana.com';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const CACHE_MS = 60_000;

export const PROGRAMS = [
  { name: 'wrapper', id: '6Grr3eyuJVME5gDbeT6g6Q3pojQGSuSDaEmHDM7QYhzx' },
  { name: 'stake', id: '85rgQvJsqVq5gF9TPMtxmPQaoVMGK1wd6qx1FZqfXk5q' },
  { name: 'nft', id: 'GDaUkuhbErfBuL92oV93bWWHEVn9NF7pRNikSeq6nHLR' },
  { name: 'matcher', id: 'EyjkN2LRcnMfTcfChz4R33nYHKWMbuKVKRufUx2TfuXE' },
];

export const REPOS = [
  { owner: 'Solizardking', name: 'clawd-percolator', branch: 'main', public: true },
  { owner: 'Solizardking', name: 'percolator-prog', branch: 'main', public: true },
  { owner: 'Solizardking', name: 'percolator-match', branch: 'master', public: true },
  { owner: 'Solizardking', name: 'percolator-cli', branch: 'master', public: true },
  { owner: 'Solizardking', name: 'percolator-meta', branch: 'master', public: true },
  { owner: 'Solizardking', name: 'percolator-stress-test', branch: 'master', public: true },
  { owner: 'Solizardking', name: 'percolator-launch', branch: 'main', public: true },
  { owner: 'themusebook', name: 'clawd-chain', branch: 'main', public: true },
];

const SECRET_RE = new RegExp([
  String.raw`\b(sk|pk|api[_-]?key|apikey|secret|token|password|passwd|pwd|bearer|authorization|private[_-]?key|mnemonic|seed|rpc[_-]?url)\b\s*[:=]\s*\S+`,
  String.raw`\b(sk-|ghp_|gho_|github_pat_|xox[baprs]-|AKIA)[A-Za-z0-9_\-]{8,}`,
  String.raw`\b[0-9a-fA-F]{64}\b`,
  String.raw`\b[1-9A-HJ-NP-Za-km-z]{87,88}\b`,
].join('|'), 'i');

export function scrubMessage(msg) {
  const first = String(msg || '').split('\n')[0].trim().slice(0, 200);
  if (!first) return '(empty)';
  if (SECRET_RE.test(first)) return '[redacted: looked like a secret]';
  return first;
}

export function toET(iso) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZoneName: 'short',
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

async function ghJson(url, env) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'percolator-tech-feed',
  };
  // Optional server-side token for rate limits — never exposed to the browser.
  if (env && env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + env.GITHUB_TOKEN;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('GitHub ' + r.status + ' ' + t.slice(0, 120));
  }
  return r.json();
}

async function fetchRepoCommits(repo, env, perPage = 6) {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=${perPage}&sha=${encodeURIComponent(repo.branch)}`;
  const list = await ghJson(url, env);
  if (!Array.isArray(list)) throw new Error('unexpected commits for ' + repo.name);
  return list.map((c) => ({
    repo: repo.name,
    owner: repo.owner,
    sha: String(c.sha).slice(0, 7),
    fullSha: c.sha,
    message: scrubMessage(c.commit && c.commit.message),
    time: c.commit && c.commit.committer && c.commit.committer.date,
    timeET: toET(c.commit && c.commit.committer && c.commit.committer.date),
    url: repo.public ? c.html_url : null,
    source: 'github',
    visibility: 'public',
  }));
}

async function fetchCi(repo, env) {
  try {
    const j = await ghJson(`https://api.github.com/repos/${repo.owner}/${repo.name}/actions/runs?per_page=4`, env);
    return (j.workflow_runs || []).map((w) => ({
      repo: repo.name,
      name: w.name,
      status: w.status,
      conclusion: w.conclusion,
      sha: String(w.head_sha).slice(0, 7),
      time: w.updated_at,
      timeET: toET(w.updated_at),
      url: w.html_url,
    }));
  } catch (e) {
    return [{ repo: repo.name, name: 'actions', status: 'unavailable', conclusion: null, error: String(e.message || e).slice(0, 120) }];
  }
}

async function rpcAccount(rpc, id) {
  try {
    const r = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [id, { encoding: 'base64' }] }),
      signal: AbortSignal.timeout(8_000),
    });
    const j = await r.json();
    const v = j.result && j.result.value;
    if (!v) return { status: 'not deployed', executable: false };
    return {
      status: v.executable ? 'deployed + executable' : 'present (not executable)',
      executable: !!v.executable,
      owner: v.owner,
      lamports: v.lamports,
    };
  } catch (e) {
    return { status: 'rpc error', executable: false, error: String(e.message || e).slice(0, 120) };
  }
}

async function programMatrix() {
  const networks = [
    { key: 'clawd', label: 'clawd chain (testnet)', rpc: CLAWD_RPC },
    { key: 'devnet', label: 'Solana devnet', rpc: DEVNET_RPC },
    { key: 'mainnet', label: 'Solana mainnet', rpc: MAINNET_RPC },
  ];
  const rows = [];
  for (const p of PROGRAMS) {
    const row = { name: p.name, id: p.id, networks: {} };
    await Promise.all(networks.map(async (n) => {
      row.networks[n.key] = { label: n.label, ...(await rpcAccount(n.rpc, p.id)) };
    }));
    rows.push(row);
  }
  return { programs: rows, rpcs: { clawd: CLAWD_RPC, devnet: DEVNET_RPC, mainnet: MAINNET_RPC } };
}

async function loadSnapshot(env, requestUrl) {
  // Prefer ASSETS binding; fall back to same-origin fetch of /ops-snapshot.json
  try {
    if (env && env.ASSETS) {
      const r = await env.ASSETS.fetch(new URL('/ops-snapshot.json', requestUrl));
      if (r.ok) return await r.json();
    }
  } catch (_) {}
  try {
    const r = await fetch(new URL('/ops-snapshot.json', requestUrl), { signal: AbortSignal.timeout(5_000) });
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}

let cache = { exp: 0, body: null, building: null };

export async function buildFeed(env, requestUrl) {
  const generatedAt = new Date().toISOString();
  const commitResults = await Promise.allSettled(REPOS.map((r) => fetchRepoCommits(r, env)));
  const commits = [];
  const commitErrors = [];
  for (const r of commitResults) {
    if (r.status === 'fulfilled') commits.push(...r.value);
    else commitErrors.push(String(r.reason && r.reason.message || r.reason).slice(0, 160));
  }
  commits.sort((a, b) => (Date.parse(b.time || 0) || 0) - (Date.parse(a.time || 0) || 0));

  const ciRepos = new Set(['clawd-percolator', 'percolator-prog', 'percolator-match', 'percolator-cli', 'percolator-stress-test']);
  const ciResults = await Promise.allSettled(REPOS.filter((r) => ciRepos.has(r.name)).map((r) => fetchCi(r, env)));
  const ci = [];
  for (const r of ciResults) if (r.status === 'fulfilled') ci.push(...r.value);

  const snap = await loadSnapshot(env, requestUrl);
  const kani = snap && snap.kani
    ? {
        available: !!snap.kani.available,
        generated: snap.kani.generated,
        pass: snap.kani.pass,
        expectedFail: snap.kani.expectedFail,
        timeout: snap.kani.timeout,
        fail: snap.kani.fail,
        total: snap.kani.total,
        path: 'ops-snapshot.json (static asset)',
        notes: [
          'Kani counts come from a sanitized box snapshot refreshed on redeploy (not live CBMC).',
          'See /proofs for the full harness table, scrubbed logs, and upstream progress. Timeouts are not passes.',
        ],
        inProgress: snap.kani.inProgress || {},
        snapshotUpdatedAtET: snap.updatedAtET,
      }
    : {
        available: false,
        pass: null, expectedFail: null, timeout: null, fail: null, total: null,
        notes: ['ops-snapshot.json missing on this deploy'],
        inProgress: {},
      };

  const ops = snap && snap.ops
    ? {
        available: !!snap.ops.available,
        note: (snap.ops.note || '') + ' Snapshot updated ' + (snap.updatedAtET || snap.updatedAt || ''),
        keeper: snap.ops.keeper,
        oracle: snap.ops.oracle,
      }
    : { available: false, note: 'Keeper/oracle snapshot unavailable on edge until ops-snapshot.json is published.', keeper: null, oracle: null };

  const programs = await programMatrix();

  return {
    branding: '$CLAWD',
    contact: 'clawdbot@mail.grokbot.com',
    disclaimer: 'One of the first transparent build feeds for $CLAWD Percolator on clawd chain. No promises of returns. Devnet / clawd chain first.',
    generatedAt,
    generatedAtET: toET(generatedAt),
    cacheSeconds: Math.round(CACHE_MS / 1000),
    commits: commits.slice(0, 60),
    commitErrors,
    ci,
    kani,
    programs,
    ops,
    privacy: {
      publicReposShown: REPOS.map((r) => `${r.owner}/${r.name}`),
      localOnly: ['clawd-percolator-kani', 'clawd-percolator-bot'],
      note: 'GitHub repos in this feed are public. Kani/keeper values are from a sanitized snapshot asset, not live box filesystem.',
    },
  };
}

export async function getFeed(env, requestUrl) {
  if (cache.body && Date.now() < cache.exp) return cache.body;
  if (cache.building) return cache.building;
  cache.building = buildFeed(env, requestUrl)
    .then((body) => {
      cache = { exp: Date.now() + CACHE_MS, body, building: null };
      return body;
    })
    .catch((e) => {
      cache.building = null;
      throw e;
    });
  return cache.building;
}
