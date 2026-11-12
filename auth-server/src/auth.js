// Better Auth for https://percolator.tech, mounted at basePath /api/auth.
// Secrets come from the environment only. Never print, log, or commit them.
import { betterAuth } from "better-auth";
import { dash, sentinel } from "@better-auth/infra";
import pg from "pg";

export const TRUSTED_ORIGINS = [
  "https://percolator.tech",
  "https://www.percolator.tech",
];

export const AUTH_BASE_URL = process.env.BETTER_AUTH_URL || "https://percolator.tech";
export const AUTH_BASE_PATH = process.env.BETTER_AUTH_BASE_PATH || "/api/auth";

// Neon Auth is a hosted Better Auth instance on the same Neon project.
// We self-host Better Auth on Railway (this process) so we can set
// baseURL https://percolator.tech, basePath /api/auth, first-party cookies,
// and the Sentinel policy. Neon Auth JWTs are a different issuer than our
// sessions, so this service does not verify them as logins. The URLs are
// recorded as config for a later integration if we need one.
export const NEON_AUTH_URL =
  process.env.NEON_AUTH_URL ||
  "https://ep-polished-meadow-bdenluzg.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth";
export const NEON_AUTH_JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  "https://ep-polished-meadow-bdenluzg.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json";

export function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: true },
  });
}

export function createAuth(options = {}) {
  const pool = options.pool || createPool(options.connectionString);
  const secret = options.secret ?? process.env.BETTER_AUTH_SECRET;
  const apiKey = options.apiKey ?? process.env.BETTER_AUTH_API_KEY;
  return betterAuth({
    baseURL: AUTH_BASE_URL,
    basePath: AUTH_BASE_PATH,
    secret,
    database: pool,
    trustedOrigins: TRUSTED_ORIGINS,
    emailAndPassword: {
      enabled: true,
      // No mail transport is configured yet.
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
        apiKey,
        sentinelHeaders: "modern",
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
        },
      }),
      // Dash ownership checks. apiKey only; the plugin default kvUrl is the KV origin.
      // activityTracking stays off so lastActiveAt is not added. Secrets stay in the environment.
      dash({ apiKey }),
    ],
  });
}
