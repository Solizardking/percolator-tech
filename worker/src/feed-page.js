function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pill(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('executable') || s === 'success' || s === 'running' || s.includes('pass') || s === 'in_progress') {
    const cls = s === 'in_progress' || s === 'cancelled' ? '' : 'ok';
    if (s === 'in_progress' || s === 'cancelled') {
      return `<span class="pill" style="background:#a259ff22;color:var(--pur)">${esc(status)}</span>`;
    }
    return `<span class="pill ok">${esc(status)}</span>`;
  }
  if (s.includes('not deployed') || s === 'failure' || s.includes('fail') || s === 'stopped') {
    return `<span class="pill bad">${esc(status)}</span>`;
  }
  return `<span class="pill" style="background:#a259ff22;color:var(--pur)">${esc(status)}</span>`;
}

export function renderFeedHtml(data, nav) {
  const commits = (data.commits || []).map((c) => {
    const link = c.url
      ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.sha)}</a>`
      : `<span class="mono">${esc(c.sha)}</span>`;
    const vis = c.visibility === 'public'
      ? '<span class="pill ok">public</span>'
      : `<span class="pill" style="background:#ff8a3d22;color:var(--org)">${esc(c.visibility)}</span>`;
    return `<tr>
      <td><span class="mono">${esc(c.repo)}</span> ${vis}</td>
      <td class="mono">${link}</td>
      <td style="white-space:normal;max-width:420px">${esc(c.message)}</td>
      <td>${esc(c.timeET || '—')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" class="sub">No commits loaded.</td></tr>`;

  const k = data.kani || {};
  const kaniBlock = k.available
    ? `<div class="grid g4">
        <div class="card stat"><div class="k">PASS</div><div class="v" style="color:var(--grn)">${esc(k.pass)}</div></div>
        <div class="card stat"><div class="k">Expected-fail</div><div class="v" style="color:var(--cy)">${esc(k.expectedFail)}</div></div>
        <div class="card stat"><div class="k">TIMEOUT</div><div class="v" style="color:var(--org)">${esc(k.timeout)}</div></div>
        <div class="card stat"><div class="k">FAIL</div><div class="v" style="color:var(--red)">${esc(k.fail)}</div></div>
      </div>
      <p class="sub" style="margin-top:12px">Report generated: ${esc(k.generated || '—')} · total harnesses ${esc(k.total)} · source <code>${esc(k.path)}</code>${k.snapshotUpdatedAtET ? ' · snapshot ' + esc(k.snapshotUpdatedAtET) : ''}</p>
      <div class="kv" style="margin-top:10px">
        <div>Longer timeout rerun</div><div>${esc(k.inProgress && k.inProgress.longerTimeoutRerun)}</div>
        <div>~335 upstream engine proofs</div><div>${esc(k.inProgress && k.inProgress.upstreamEngineProofs)}</div>
      </div>
      ${(k.notes || []).map((n) => `<p class="sub">${esc(n)}</p>`).join('')}
      <p style="margin-top:14px"><a class="btn hot" href="/proofs">Open full proofs page</a>
      <a class="btn" href="/proofs.json" style="margin-left:8px">proofs.json</a></p>`
    : `<p class="sub">Kani report snapshot not available on this deploy.</p>
      <p><a class="btn" href="/proofs">Proofs page</a></p>`;

  const ciRows = (data.ci || []).slice(0, 20).map((w) => {
    const st = w.conclusion || w.status || '—';
    const link = w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.name)}</a>` : esc(w.name || '—');
    return `<tr>
      <td class="mono">${esc(w.repo)}</td>
      <td>${link}</td>
      <td>${pill(st)}</td>
      <td class="mono">${esc(w.sha || '—')}</td>
      <td>${esc(w.timeET || '—')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="sub">No Actions runs found (or API unavailable).</td></tr>`;

  const prog = data.programs || {};
  const progRows = (prog.programs || []).map((p) => {
    const cell = (key) => {
      const n = (p.networks && p.networks[key]) || {};
      return `<td>${pill(n.status || '—')}${n.error ? `<div class="sub">${esc(n.error)}</div>` : ''}</td>`;
    };
    return `<tr>
      <td><strong>${esc(p.name)}</strong><div class="mono trunc" title="${esc(p.id)}">${esc(p.id)}</div></td>
      ${cell('clawd')}${cell('devnet')}${cell('mainnet')}
    </tr>`;
  }).join('');

  const ops = data.ops || {};
  const opsHtml = ops.available
    ? `<div class="grid g2">
        <div class="card"><h3 style="margin-top:0">Keeper</h3>
          <div class="kv">
            <div>Status</div><div>${ops.keeper && ops.keeper.running ? pill('running') : pill('stopped')}</div>
            <div>pid</div><div class="mono">${esc(ops.keeper && ops.keeper.pid)}</div>
          </div>
        </div>
        <div class="card"><h3 style="margin-top:0">Oracle pusher</h3>
          <div class="kv">
            <div>Status</div><div>${ops.oracle && ops.oracle.running ? pill('running') : pill('stopped')}</div>
            <div>pid</div><div class="mono">${esc(ops.oracle && ops.oracle.pid)}</div>
          </div>
        </div>
      </div>
      <p class="sub">${esc(ops.note || '')}</p>`
    : `<p class="sub">${esc(ops.note || 'Ops status unavailable.')}</p>`;

  const errHtml = (data.commitErrors || []).length
    ? `<p class="sub" style="color:var(--org)">Commit fetch notes: ${esc(data.commitErrors.join(' · '))}</p>`
    : '';

  const feedCss = `
.feed-hero{margin:8px 0 22px}
.feed-hero .sub{max-width:720px}
.section{margin:28px 0}
.section h2{margin:0 0 12px;font-size:22px}
.meta{color:var(--dim);font-size:13px;margin:0 0 16px}
table.feed td,table.feed th{white-space:nowrap}
table.feed td:nth-child(3){white-space:normal}
.refresh{display:inline-flex;align-items:center;gap:8px;margin-left:10px}
nav a.on{color:var(--txt)}
`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$CLAWD Percolator · feed</title>
<link rel="icon" href="/logo.svg"><link rel="stylesheet" href="/style.css">
<style>${feedCss}</style></head><body>
${nav}
<main class="wrap">
  <div class="feed-hero">
    <h1 style="font-size:42px;line-height:1.05;margin:0 0 8px"><span class="glow">$CLAWD</span> Percolator feed</h1>
    <p class="sub">${esc(data.disclaimer)}</p>
    <p class="meta">Live snapshot · ${esc(data.generatedAtET)} · cache ${esc(data.cacheSeconds)}s
      <span class="refresh"><span class="dot"></span> auto-refreshes</span>
      · contact <a href="mailto:${esc(data.contact)}">${esc(data.contact)}</a>
      · <a href="/">back to home</a>
      · <a href="/proofs">proofs</a>
      · <a href="/api/feed">JSON</a>
    </p>
  </div>

  <section class="section card">
    <h2>Programs by network</h2>
    <p class="sub">Probed live via getAccountInfo. Mainnet shows not deployed unless the chain says otherwise.</p>
    <div style="overflow-x:auto">
      <table class="feed">
        <thead><tr><th>Program</th><th>clawd chain</th><th>Solana devnet</th><th>Solana mainnet</th></tr></thead>
        <tbody>${progRows}</tbody>
      </table>
    </div>
    <p class="sub mono">RPCs: clawd=${esc(prog.rpcs && prog.rpcs.clawd)} · devnet=${esc(prog.rpcs && prog.rpcs.devnet)} · mainnet=${esc(prog.rpcs && prog.rpcs.mainnet)}</p>
  </section>

  <section class="section card">
    <h2>Kani verification</h2>
    ${kaniBlock}
  </section>

  <section class="section card">
    <h2>CI / Actions</h2>
    <div style="overflow-x:auto">
      <table class="feed">
        <thead><tr><th>Repo</th><th>Workflow</th><th>Status</th><th>SHA</th><th>Updated (ET)</th></tr></thead>
        <tbody>${ciRows}</tbody>
      </table>
    </div>
  </section>

  <section class="section card">
    <h2>Keeper &amp; oracle</h2>
    ${opsHtml}
  </section>

  <section class="section card">
    <h2>Recent commits</h2>
    <p class="sub">Newest first. Messages only (no diffs). Secret-looking subjects are redacted.</p>
    ${errHtml}
    <div style="overflow-x:auto">
      <table class="feed">
        <thead><tr><th>Repo</th><th>SHA</th><th>Message</th><th>Time (ET)</th></tr></thead>
        <tbody>${commits}</tbody>
      </table>
    </div>
    <p class="sub">${esc(data.privacy && data.privacy.note)}</p>
  </section>
</main>
<footer>percolator.tech · $CLAWD · one of the first transparent Percolator feeds · ${esc(data.contact)}</footer>
<script>
setTimeout(function(){ location.reload(); }, ${(Number(data.cacheSeconds)||60)*1000 + 1500});
</script>
</body></html>`;
}
