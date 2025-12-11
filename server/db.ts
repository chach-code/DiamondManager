import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

/**
 * Initialize database schema - creates all tables if they don't exist
 * This is a simple approach that ensures tables exist on startup
 */
export async function initializeDatabase() {
  try {
    // Create sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `);
    
    // Create index on sessions.expire
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)
    `);

    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR NOT NULL PRIMARY KEY,
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create teams table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create players table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        number TEXT NOT NULL,
        positions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create lineups table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lineups (
        id VARCHAR NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        player_ids TEXT[] NOT NULL,
        position_map JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  }
}
