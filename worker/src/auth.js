// Better Auth for https://percolator.tech, mounted at the default basePath /api/auth.
// This module is wired on the feat/better-auth branch only. Do not set
// BETTER_AUTH_API_KEY or BETTER_AUTH_SECRET in source, wrangler vars, or
// committed files. Pass them as Worker secrets at an approved production
// deploy. Do not print those values.
import { betterAuth } from "better-auth";
import { sentinel } from "@better-auth/infra";

const TRUSTED_ORIGINS = [
  "https://percolator.tech",
  "https://www.percolator.tech",
];

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

/**
 * @param {{ AUTH_DB?: D1Database, BETTER_AUTH_SECRET?: string, BETTER_AUTH_API_KEY?: string, BETTER_AUTH_URL?: string }} env
 */
export function createAuth(env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL || "https://percolator.tech",
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: env.AUTH_DB,
    trustedOrigins: TRUSTED_ORIGINS,
    emailAndPassword: {
      enabled: true,
      // No email provider is configured yet. Do not require verification
      // until an owner-approved mail transport exists.
      requireEmailVerification: false,
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      sentinel({
        // Workers do not automatically expose wrangler secrets on process.env.
        // Read the binding from env. Never hard-code the key.
        apiKey: env.BETTER_AUTH_API_KEY,
        sentinelHeaders: "modern",
        // Start in log / challenge. Tune from the Better Auth dashboard
        // before flipping high-impact checks to block.
        security: {
          credentialStuffing: {
            enabled: true,
            action: "challenge",
            thresholds: { challenge: 3, block: 8 },
            windowSeconds: 3600,
            cooldownSeconds: 900,
          },
          compromisedPassword: {
            enabled: true,
            action: "challenge",
            minBreachCount: 1,
          },
          emailValidation: {
            enabled: true,
            strictness: "medium",
            action: "log",
          },
          emailNormalization: { enabled: true },
          impossibleTravel: {
            enabled: true,
            maxSpeedKmh: 1000,
            action: "log",
          },
          velocity: {
            enabled: true,
            action: "challenge",
            thresholds: { challenge: 10, block: 20 },
            windowSeconds: 3600,
          },
          botBlocking: { action: "challenge" },
          suspiciousIpBlocking: { action: "log" },
          freeTrialAbuse: { enabled: true, action: "log" },
          // Geo-blocking is off until there is an explicit country policy.
          // Stale-user email notifications are off until a mail transport exists.
        },
      }),
    ],
  });
}

/**
 * Handle /api/auth/* when AUTH_DB and BETTER_AUTH_SECRET are bound.
 * Missing config returns 503 so a partial deploy cannot look like a working signup.
 */
export function handleAuth(request, env) {
  if (!env.AUTH_DB || !env.BETTER_AUTH_SECRET) {
    return authNotConfigured();
  }
  return createAuth(env).handler(request);
}
