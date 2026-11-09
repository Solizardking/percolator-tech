import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getFeed } from './feed-data.js';
import { renderFeedHtml } from './feed-page.js';

import { legalResponse } from './legal-pages.js';

const NAV = `<nav><a class="brand" href="/"><img src="/logo.svg" width="34" alt=""> percolator</a><span class="sp"></span>
<a href="/">Home</a><a class="on" href="/feed">Feed</a>
<a href="/proofs">Proofs</a>
<a href="/trade">Trade</a><a href="/stake">Stake</a>
<a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a>
<a href="https://percolator.clawdchain.trade/">clawd chain app</a>
<a href="https://explorer.clawdchain.trade/explorer">Explorer</a>
<a href="https://github.com/Solizardking/clawd-percolator">GitHub</a></nav>`;

const MARKETS_URL = 'https://percolator.clawdchain.trade/api/markets';

let jwksCache = { url: null, set: null };
function jwksFor(env) {
  const url = env.PRIVY_JWKS || (env.PRIVY_APP_ID ? `https://auth.privy.io/api/v1/apps/${env.PRIVY_APP_ID}/jwks.json` : null);
  if (!url) throw new Error('PRIVY_JWKS / PRIVY_APP_ID not configured');
  if (jwksCache.url !== url) {
    jwksCache = { url, set: createRemoteJWKSet(new URL(url)) };
  }
  return jwksCache.set;
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, OPTIONS',
    },
  });
}

async function handleMe(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'GET, OPTIONS',
      },
    });
  }
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return json(401, { error: 'missing bearer token' });
  const appId = env.PRIVY_APP_ID;
  if (!appId) return json(500, { error: 'PRIVY_APP_ID not configured' });
  try {
    const { payload } = await jwtVerify(m[1].trim(), jwksFor(env), {
      algorithms: ['ES256'],
      issuer: 'privy.io',
      audience: appId,
      typ: 'JWT',
    });
    // Never return secrets. wallet-auth private key is unused here.
    return json(200, {
      userId: payload.sub,
      sessionId: payload.sid || null,
      appId: payload.aud,
      appClientId: payload.app_client_id || null,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      network: 'clawd-chain-testnet',
    });
  } catch (e) {
    return json(401, { error: 'invalid token' });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    }

    const legalSlug = ({
      '/privacy': 'privacy', '/privacy/': 'privacy',
      '/terms': 'terms', '/terms/': 'terms',
      '/support': 'support', '/support/': 'support',
    })[url.pathname];
    if (legalSlug) {
      const page = legalResponse(legalSlug);
      if (page) return page;
    }

    if (url.pathname === '/api/me') return handleMe(request, env);

    if (url.pathname === '/api/markets') {
      try {
        const r = await fetch(MARKETS_URL, { signal: AbortSignal.timeout(8_000) });
        const body = await r.text();
        return new Response(body, {
          status: r.status,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=5',
            'access-control-allow-origin': '*',
          },
        });
      } catch (e) {
        return json(502, { markets: [], error: 'markets upstream unavailable' });
      }
    }

    if (url.pathname === '/api/feed') {
      try {
        const body = await getFeed(env, request.url);
        return new Response(JSON.stringify(body), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=30',
            'access-control-allow-origin': '*',
          },
        });
      } catch (e) {
        return json(502, { error: String(e.message || e).slice(0, 200) });
      }
    }

    if (url.pathname === '/feed' || url.pathname === '/feed/') {
      try {
        const body = await getFeed(env, request.url);
        const html = renderFeedHtml(body, NAV);
        return new Response(html, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
        });
      } catch (e) {
        return new Response('feed unavailable: ' + String(e.message || e).slice(0, 200), {
          status: 502,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
    }

    if (env.ASSETS) {
      // Map /trade and /stake to their HTML files when path has no extension
      let assetReq = request;
      if (url.pathname === '/trade' || url.pathname === '/trade/') {
        assetReq = new Request(new URL('/trade.html', url.origin), request);
      } else if (url.pathname === '/stake' || url.pathname === '/stake/') {
        assetReq = new Request(new URL('/stake.html', url.origin), request);
      } else if (url.pathname === '/proofs' || url.pathname === '/proofs/') {
        assetReq = new Request(new URL('/proofs.html', url.origin), request);
      }
      return env.ASSETS.fetch(assetReq);
    }
    return new Response('not found', { status: 404 });
  },
};
