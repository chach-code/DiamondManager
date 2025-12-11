import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table (for session store)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Players table
export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  number: text("number").notNull(),
  positions: text("positions").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lineups table (for saving batting orders and field positions)
export const lineups = pgTable("lineups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // 'batting' or 'positions'
  playerIds: text("player_ids").array().notNull(),
  positionMap: jsonb("position_map"), // for field positions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types for auth
export type User = typeof users.$inferSelect;
export type UpsertUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
};

// Team types
// Note: userId is omitted because it's added server-side from the authenticated user
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

// Player types
// Note: teamId is omitted because it's provided via the route parameter
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, teamId: true, createdAt: true, updatedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

// Lineup types
// Note: teamId is omitted because it's provided via the route parameter
export const insertLineupSchema = createInsertSchema(lineups).omit({ id: true, teamId: true, createdAt: true, updatedAt: true });
export type InsertLineup = z.infer<typeof insertLineupSchema>;
export type Lineup = typeof lineups.$inferSelect;
