/**
 * percolator-install — install.percolator.tech
 * Tracks clawd-percolator skill / repo / template / agent installs in D1.
 * Never stores raw IPs (HMAC-SHA256 with IP_HASH_SALT secret).
 */

const SOURCES = new Set(['skill', 'repo', 'template', 'agent', 'test']);
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;
const PUBLIC_BASE = 'https://install.percolator.tech';

function corsHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...extra,
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(),
      ...extra,
    },
  });
}

function text(body, status = 200, type = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status,
    headers: { 'content-type': type, 'cache-control': 'no-store', ...corsHeaders() },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '0.0.0.0'
  );
}

async function hashIp(ip, salt) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(salt || 'missing-salt')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(ip)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validateInstall(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object';
  if (typeof body.source !== 'string' || !SOURCES.has(body.source)) {
    return 'source must be one of skill|repo|template|agent|test';
  }
  for (const k of ['agent_id', 'version', 'cluster']) {
    if (body[k] !== undefined && typeof body[k] !== 'string') return `${k} must be a string`;
    if (typeof body[k] === 'string' && body[k].length > 128) return `${k} too long`;
  }
  return null;
}

async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS installs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      source TEXT NOT NULL,
      agent_id TEXT,
      version TEXT,
      cluster TEXT,
      ip_hash TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS installs_source_idx ON installs (source)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS installs_ts_idx ON installs (ts)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS installs_ip_ts_idx ON installs (ip_hash, ts)`),
  ]);
}

async function rateLimitCount(db, ipHash) {
  const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const row = await db
    .prepare(`SELECT count(*) AS n FROM installs WHERE ip_hash = ? AND ts > ?`)
    .bind(ipHash, cutoff)
    .first();
  return row?.n || 0;
}

async function insertInstall(db, { source, agentId, version, cluster, ipHash }) {
  const r = await db
    .prepare(
      `INSERT INTO installs (source, agent_id, version, cluster, ip_hash)
       VALUES (?, ?, ?, ?, ?) RETURNING id, ts`
    )
    .bind(source, agentId || null, version || null, cluster || null, ipHash)
    .first();
  return r;
}

async function stats(db) {
  const totals = await db
    .prepare(
      `SELECT count(*) AS total,
              sum(CASE WHEN ts > ? THEN 1 ELSE 0 END) AS last24h
       FROM installs WHERE source <> 'test'`
    )
    .bind(new Date(Date.now() - 864e5).toISOString())
    .first();
  const bySourceRows = await db
    .prepare(
      `SELECT source, count(*) AS n FROM installs WHERE source <> 'test' GROUP BY source ORDER BY n DESC`
    )
    .all();
  const byDayRows = await db
    .prepare(
      `SELECT substr(ts, 1, 10) AS d, count(*) AS n
       FROM installs WHERE source <> 'test'
       GROUP BY 1 ORDER BY 1`
    )
    .all();
  const bySource = Object.fromEntries((bySourceRows.results || []).map((r) => [r.source, r.n]));
  const byDay = Object.fromEntries((byDayRows.results || []).map((r) => [r.d, r.n]));
  return {
    ok: true,
    total: totals?.total || 0,
    last24h: totals?.last24h || 0,
    bySource,
    byDay,
  };
}

function installPingScript(source) {
  const src = SOURCES.has(source) ? source : 'repo';
  return `#!/usr/bin/env bash
# Percolator install ping — fires once, never blocks the install.
set -euo pipefail
BASE="${PUBLIC_BASE}"
SRC="${src}"
AGENT_ID="\${PERCOLATOR_AGENT_ID:-}"
VERSION="\${PERCOLATOR_VERSION:-}"
CLUSTER="\${PERCOLATOR_CLUSTER:-}"
payload=$(printf '{"source":"%s"' "$SRC")
[ -n "$AGENT_ID" ] && payload+=$(printf ',"agent_id":"%s"' "$AGENT_ID")
[ -n "$VERSION" ] && payload+=$(printf ',"version":"%s"' "$VERSION")
[ -n "$CLUSTER" ] && payload+=$(printf ',"cluster":"%s"' "$CLUSTER")
payload+='}'
curl -fsS -m 5 -X POST "$BASE/api/install" \\
  -H 'content-type: application/json' \\
  -d "$payload" >/dev/null 2>&1 || true
`;
}

function statsPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Installs · install.percolator.tech</title>
<meta name="description" content="Public install counter for the clawd-percolator skill, percolator-skill repo, and Percolator bot template.">
<style>
:root{
  --bg:#07060d; --panel:#0d0b18; --line:#241f3d; --line2:#322a55;
  --txt:#ece9f7; --dim:#9a92bd; --dim2:#6d6590;
  --purple:#9945FF; --green:#14F195; --cyan:#38e1ff; --amber:#ffb454;
  --grad:linear-gradient(92deg,#9945FF,#14F195);
}
*{box-sizing:border-box} html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:15px/1.55 Inter,system-ui,-apple-system,sans-serif}
a{color:var(--cyan);text-decoration:none} a:hover{text-decoration:underline}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:.9em}
.sub{color:var(--dim)}
header.bar{display:flex;align-items:center;gap:14px;padding:10px 18px;border-bottom:1px solid var(--line);background:rgba(10,8,20,.92)}
.wordmark{font-weight:800;font-size:18px}
.wordmark .grad{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px 64px}
h1{font-size:clamp(28px,4vw,42px);margin:8px 0 10px;letter-spacing:-.8px}
.chips{display:flex;gap:22px;flex-wrap:wrap;margin:18px 0}
.chipstat .k{color:var(--dim2);font-size:11px;letter-spacing:1.2px;text-transform:uppercase}
.chipstat .v{font-size:28px;font-weight:800}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
th{color:var(--dim);font-size:11.5px;letter-spacing:.6px;text-transform:uppercase}
.warn{border:1px solid #5c4a17;background:#171106;border-radius:12px;padding:12px 16px;color:#f3d9a4;font-size:14px;margin:14px 0}
</style>
</head>
<body>
<header class="bar">
  <div class="wordmark"><a href="https://percolator.tech" style="text-decoration:none"><span class="grad">Percolator</span></a></div>
  <a href="https://percolator.tech" class="sub">← home</a>
  <div style="flex:1"></div>
  <a href="/api/installs/stats" class="mono small">/api/installs/stats</a>
</header>
<main class="wrap">
  <div class="sub mono" style="color:var(--green)">// install.percolator.tech</div>
  <h1>Every Percolator install</h1>
  <p class="sub">Counts clawd-percolator skill installs, percolator-skill repo install scripts, and bots created from the Percolator · Solana perps template. Public totals exclude <span class="mono">source=test</span>. IPs are HMAC-hashed; raw IPs are never stored.</p>
  <div class="warn"><b>Educational.</b> This counter is for ops visibility only — not a growth claim. Brand is <b>$CLAWD</b>.</div>
  <div class="chips">
    <div class="chipstat"><div class="k">Total</div><div class="v" id="total">—</div></div>
    <div class="chipstat"><div class="k">Last 24h</div><div class="v" id="last24">—</div></div>
  </div>
  <div class="card">
    <h3 style="margin:0 0 10px">By source</h3>
    <table><thead><tr><th>Source</th><th>Count</th></tr></thead><tbody id="bySource"></tbody></table>
  </div>
  <div class="card">
    <h3 style="margin:0 0 10px">By day (UTC)</h3>
    <table><thead><tr><th>Day</th><th>Count</th></tr></thead><tbody id="byDay"></tbody></table>
  </div>
  <div class="card mono" style="font-size:13px">
    # ping from an install script<br>
    curl -fsS https://install.percolator.tech/i/skill.sh | bash<br>
    curl -fsS -X POST https://install.percolator.tech/api/install \\<br>
    &nbsp;&nbsp;-H 'content-type: application/json' \\<br>
    &nbsp;&nbsp;-d '{"source":"repo","version":"0.1.0","cluster":"clawd"}'
  </div>
</main>
<script>
async function load(){
  const s = await fetch('/api/installs/stats').then(r=>r.json());
  document.getElementById('total').textContent = s.total ?? 0;
  document.getElementById('last24').textContent = s.last24h ?? 0;
  const src = s.bySource || {};
  document.getElementById('bySource').innerHTML = Object.keys(src).length
    ? Object.entries(src).map(([k,v])=>'<tr><td class="mono">'+k+'</td><td>'+v+'</td></tr>').join('')
    : '<tr><td colspan="2" class="sub">No installs yet</td></tr>';
  const days = s.byDay || {};
  document.getElementById('byDay').innerHTML = Object.keys(days).length
    ? Object.entries(days).reverse().map(([k,v])=>'<tr><td class="mono">'+k+'</td><td>'+v+'</td></tr>').join('')
    : '<tr><td colspan="2" class="sub">No installs yet</td></tr>';
}
load().catch(()=>{ document.getElementById('total').textContent = 'err'; });
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (request.method === 'GET' && (path === '/api/health' || path === '/healthz' || path === '/health')) {
        return json({ ok: true, service: 'percolator-install' });
      }

      if (!env.DB) return json({ error: 'DB binding missing' }, 500);
      await ensureSchema(env.DB);

      if (request.method === 'GET' && path === '/api/installs/stats') {
        return json(await stats(env.DB));
      }

      if (request.method === 'POST' && path === '/api/install') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'invalid JSON' }, 400);
        }
        const err = validateInstall(body);
        if (err) return json({ error: err }, 400);

        const ip = clientIp(request);
        const ipHash = await hashIp(ip, env.IP_HASH_SALT);
        const recent = await rateLimitCount(env.DB, ipHash);
        if (recent >= RATE_MAX) return json({ error: 'rate limited' }, 429);

        const saved = await insertInstall(env.DB, {
          source: body.source,
          agentId: body.agent_id,
          version: body.version,
          cluster: body.cluster,
          ipHash,
        });
        return json({ ok: true, id: saved?.id }, 201);
      }

      const ping = path.match(/^\/i\/([a-z]+)\.sh$/);
      if (request.method === 'GET' && ping) {
        return text(installPingScript(ping[1]), 200, 'text/x-shellscript; charset=utf-8');
      }

      if (request.method === 'GET' && (path === '/' || path === '/installs')) {
        return html(statsPage());
      }

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'internal error', detail: String(e?.message || e).slice(0, 160) }, 500);
    }
  },
};
