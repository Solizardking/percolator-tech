import assert from "node:assert/strict";
import test from "node:test";

// Drop secret env vars before the auth module loads so this test cannot
// read or open a real database.
delete process.env.DATABASE_URL;
delete process.env.BETTER_AUTH_SECRET;
delete process.env.BETTER_AUTH_API_KEY;

const { createAuth } = await import("../src/auth.js");

function stubPool() {
  const fail = (method) => () => {
    throw new Error(`pool.${method} called`);
  };
  return {
    query: fail("query"),
    connect: fail("connect"),
  };
}

test("createAuth mounts dash and sentinel", async () => {
  const secret = "test-secret-0123456789abcdef0123456789abcdef";
  assert.ok(secret.length >= 32);

  const auth = createAuth({
    pool: stubPool(),
    secret,
    apiKey: "test-api-key",
  });

  const plugins = auth.options?.plugins ?? [];
  const ids = plugins.map((plugin) => plugin.id);
  assert.ok(ids.includes("dash"));
  assert.ok(ids.includes("sentinel"));

  const dashPlugin = plugins.find((plugin) => plugin.id === "dash");
  assert.equal(dashPlugin.options.kvUrl, "https://kv.better-auth.com");
  assert.notEqual(dashPlugin.options.activityTracking?.enabled, true);

  // Init must not query the stub. A thrown pool error fails the test.
  await auth.$context;
});
