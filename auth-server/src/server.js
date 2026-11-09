// Node HTTP entry for Railway. Better Auth is served at /api/auth.
// When this process sits behind the percolator.tech Worker proxy, the
// handler uses X-Forwarded-Host / X-Forwarded-Proto so cookies and
// redirects stay on percolator.tech (toNodeHandler would otherwise use
// the Railway Host header).
import { createServer } from "node:http";
import { AUTH_BASE_URL, AUTH_BASE_PATH, isAuthConfigured, createAuth, TRUSTED_ORIGINS } from "./auth.js";

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_HOSTS = new Set(
  TRUSTED_ORIGINS.map((origin) => new URL(origin).host),
);

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function firstHeader(value) {
  if (value == null) return "";
  const raw = Array.isArray(value) ? value[0] : String(value);
  return raw.split(",")[0].trim();
}

function requestOrigin(req) {
  const forwardedHost = firstHeader(req.headers["x-forwarded-host"]);
  const hostOnly = forwardedHost.split(":")[0];
  if (forwardedHost && (ALLOWED_HOSTS.has(hostOnly) || ALLOWED_HOSTS.has(forwardedHost))) {
    const proto = firstHeader(req.headers["x-forwarded-proto"]) || "https";
    return `${proto}://${forwardedHost}`;
  }
  return AUTH_BASE_URL;
}

function headersFromNode(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || key.startsWith(":")) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

async function writeWebResponse(res, response) {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === "set-cookie") continue;
    res.setHeader(key, value);
  }
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (!response.body) {
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

function isAuthPath(pathname) {
  return pathname === AUTH_BASE_PATH || pathname.startsWith(`${AUTH_BASE_PATH}/`);
}

const auth = isAuthConfigured() ? createAuth() : null;
if (!auth) {
  console.warn("auth is not configured; /api/auth will return 503 until DATABASE_URL and BETTER_AUTH_SECRET are set");
}

const server = createServer(async (req, res) => {
  try {
    const origin = requestOrigin(req);
    const url = new URL(req.url || "/", origin);
    if (url.pathname === "/health" || url.pathname === "/api/health") {
      return text(res, 200, "ok");
    }
    if (isAuthPath(url.pathname)) {
      if (!auth) {
        return json(res, 503, { error: "auth is not configured" });
      }
      const method = req.method || "GET";
      const hasBody = method !== "GET" && method !== "HEAD";
      const request = new Request(url, {
        method,
        headers: headersFromNode(req),
        body: hasBody ? req : undefined,
        duplex: hasBody ? "half" : undefined,
      });
      const response = await auth.handler(request);
      return writeWebResponse(res, response);
    }
    return json(res, 404, { error: "not found" });
  } catch (err) {
    console.error("request failed", err && err.message ? err.message : "unknown error");
    if (!res.headersSent) json(res, 500, { error: "internal error" });
    else res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`percolator-auth listening on ${PORT}`);
});
