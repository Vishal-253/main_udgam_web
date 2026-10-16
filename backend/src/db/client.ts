import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { requireEnv } from "../config/env";

// Neon's HTTP driver: one stateless HTTPS request per query. All multi-step registration logic
// lives in SQL functions (db/schema.sql), so each call is a single atomic transaction and no
// interactive transaction is needed here.

let client: NeonQueryFunction<false, false> | undefined;
let clientUrl: string | undefined;

export function db(): NeonQueryFunction<false, false> {
  const url = requireEnv("DATABASE_URL");
  if (!client || clientUrl !== url) {
    client = neon(url);
    clientUrl = url;
  }
  return client;
}
