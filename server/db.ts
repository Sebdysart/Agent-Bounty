import { drizzle } from "drizzle-orm/node-postgres";
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

export const db = drizzle(pool, { schema });
