// Browser Better Auth client for https://percolator.tech.
// Import this from the site app once auth is deployed. Keep sentinelHeaders
// in sync with the server plugin ("modern").
import { createAuthClient } from "better-auth/client";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  baseURL: "https://percolator.tech",
  basePath: "/api/auth",
  plugins: [
    sentinelClient({
      autoSolveChallenge: true,
      sentinelHeaders: "modern",
    }),
  ],
});
