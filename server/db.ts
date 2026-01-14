import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Default query timeout in milliseconds (30 seconds)
export const DEFAULT_QUERY_TIMEOUT_MS = 30000;

// Neon pooler configuration
// Use -pooler suffix in DATABASE_URL for connection pooling
// Format: postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon pooler recommended settings
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail connection after 10s
  // Query timeout - cancel queries that run longer than 30 seconds
  statement_timeout: DEFAULT_QUERY_TIMEOUT_MS,
});

// Standard Node.js database connection (for server environments)
export const db = drizzle(pool, { schema });

// Edge-compatible database connection using @neondatabase/serverless
// Use this in edge functions (Cloudflare Workers, Vercel Edge, etc.)
neonConfig.fetchConnectionCache = true;
const sql = neon(process.env.DATABASE_URL);
export const dbEdge = drizzleNeon(sql, { schema });

/**
 * Execute a query with a custom timeout
 * Useful for long-running operations that need more than the default 30s
 * @param timeoutMs - Query timeout in milliseconds
 * @param queryFn - Function that executes the query using a client
 */
export async function withQueryTimeout<T>(
  timeoutMs: number,
  queryFn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // Set statement timeout for this session
    await client.query(`SET statement_timeout = ${timeoutMs}`);
    const result = await queryFn(client);
    return result;
  } finally {
    // Reset to default timeout before releasing
    await client.query(`SET statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS}`);
    client.release();
  }
}
