// Proxy /api/auth/* to the Railway Better Auth service.
// The Worker stays a reverse proxy so first-party cookies stay on
// percolator.tech. Do not put secrets in this file.
export function isAuthPath(pathname) {
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

export function authNotConfigured() {
  return new Response(JSON.stringify({ error: "auth is not configured" }), {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "cf-ew-via",
  "cf-worker",
  "content-length",
]);

/**
 * @param {Request} request
 * @param {{ AUTH_UPSTREAM?: string }} env
 */
export async function handleAuth(request, env) {
  const upstream = (env.AUTH_UPSTREAM || "").replace(/\/+$/, "");
  if (!upstream) return authNotConfigured();

  const inbound = new URL(request.url);
  const target = new URL(inbound.pathname + inbound.search, upstream);
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.append(key, value);
  }
  headers.set("x-forwarded-host", inbound.host);
  headers.set("x-forwarded-proto", inbound.protocol.replace(":", "") || "https");
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "";
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const resp = await fetch(target, init);
  const outHeaders = new Headers(resp.headers);
  const location = outHeaders.get("location");
  if (location) {
    try {
      const loc = new URL(location, target);
      if (loc.host === new URL(upstream).host) {
        loc.protocol = inbound.protocol;
        loc.host = inbound.host;
        outHeaders.set("location", loc.toString());
      }
    } catch {
      // leave upstream Location unchanged if it is not a valid URL
    }
  }
  return new Response(resp.body, { status: resp.status, headers: outHeaders });
}
