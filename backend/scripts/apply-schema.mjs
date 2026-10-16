// Applies db/schema.sql to the database in DATABASE_URL. Safe to re-run.
//   npm run db:schema            (reads backend/.env if present)
import { readFileSync, existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString: url });
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.routines WHERE routine_name LIKE 'udgam_%'",
  );
  console.log(`Schema applied. ${rows[0].n} udgam_* functions present.`);
} catch (err) {
  console.error("Schema failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
