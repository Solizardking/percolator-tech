// Programmatic Better Auth migrations. Not exposed as an HTTP route.
// Prints table names only. Never prints connection strings or secrets.
import { getMigrations } from "better-auth/db/migration";
import { createAuth, createPool, isAuthConfigured } from "../src/auth.js";

function summarize(rows, label) {
  if (!rows.length) {
    console.log(`${label}: none`);
    return;
  }
  console.log(`${label}:`);
  for (const row of rows) {
    const fields = row.fields ? Object.keys(row.fields).join(", ") : "";
    const extra = fields ? ` fields=[${fields}]` : row.name ? ` name=${row.name}` : "";
    console.log(`  - ${row.table}${extra}`);
  }
}

if (!isAuthConfigured()) {
  console.error("Refusing to migrate: DATABASE_URL and BETTER_AUTH_SECRET must be set.");
  process.exit(1);
}

const pool = createPool();
try {
  const auth = createAuth({ pool });
  const plan = await getMigrations(auth.options);
  if (plan.schemaProblems?.length) {
    console.error("schema problems:");
    for (const item of plan.schemaProblems) console.error("  -", item);
    process.exit(1);
  }
  if (plan.unsafeChanges?.length) {
    console.error("unsafe changes:");
    for (const item of plan.unsafeChanges) console.error("  -", item);
    process.exit(1);
  }
  summarize(plan.toBeCreated, "toBeCreated");
  summarize(plan.toBeAdded, "toBeAdded");
  summarize(plan.toBeAddedIndexes || [], "toBeAddedIndexes");
  if (
    plan.toBeCreated.length === 0 &&
    plan.toBeAdded.length === 0 &&
    (plan.toBeAddedIndexes || []).length === 0
  ) {
    console.log("migrations: already up to date");
  } else {
    await plan.runMigrations();
    console.log("migrations: applied");
  }
} finally {
  await pool.end();
}
