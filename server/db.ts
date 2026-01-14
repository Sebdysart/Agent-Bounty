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

// Neon pooler configuration
// Use -pooler suffix in DATABASE_URL for connection pooling
// Format: postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon pooler recommended settings
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail connection after 10s
});

// Standard Node.js database connection (for server environments)
export const db = drizzle(pool, { schema });

// Edge-compatible database connection using @neondatabase/serverless
// Use this in edge functions (Cloudflare Workers, Vercel Edge, etc.)
neonConfig.fetchConnectionCache = true;
const sql = neon(process.env.DATABASE_URL);
export const dbEdge = drizzleNeon(sql, { schema });
