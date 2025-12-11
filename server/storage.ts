import { 
  type User, 
  type UpsertUser,
  type Team,
  type InsertTeam,
  type Player,
  type InsertPlayer,
  type Lineup,
  type InsertLineup,
  users,
  teams,
  players,
  lineups,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Team operations
  getUserTeams(userId: string): Promise<Team[]>;
  createTeam(team: InsertTeam & { userId: string }): Promise<Team>;
  deleteTeam(teamId: string): Promise<void>;
  updateTeam(teamId: string, data: Partial<InsertTeam>): Promise<Team>;

  // Player operations
  getTeamPlayers(teamId: string): Promise<Player[]>;
  createPlayer(player: InsertPlayer & { teamId: string }): Promise<Player>;
  updatePlayer(playerId: string, data: Partial<InsertPlayer>): Promise<Player>;
  deletePlayer(playerId: string): Promise<void>;

  // Lineup operations
  getTeamLineups(teamId: string): Promise<Lineup[]>;
  createLineup(lineup: InsertLineup & { teamId: string }): Promise<Lineup>;
  updateLineup(lineupId: string, data: Partial<InsertLineup>): Promise<Lineup>;
  deleteLineup(lineupId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Team operations
  async getUserTeams(userId: string): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.userId, userId));
  }

  async createTeam(team: InsertTeam & { userId: string }): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async updateTeam(teamId: string, data: Partial<InsertTeam>): Promise<Team> {
    const [updatedTeam] = await db
      .update(teams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
      .returning();
    return updatedTeam;
  }

  async deleteTeam(teamId: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, teamId));
  }

  // Player operations
  async getTeamPlayers(teamId: string): Promise<Player[]> {
    return db.select().from(players).where(eq(players.teamId, teamId));
  }

  async createPlayer(player: InsertPlayer & { teamId: string }): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  async updatePlayer(playerId: string, data: Partial<InsertPlayer>): Promise<Player> {
    const [updatedPlayer] = await db
      .update(players)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning();
    return updatedPlayer;
  }

  async deletePlayer(playerId: string): Promise<void> {
    await db.delete(players).where(eq(players.id, playerId));
  }

  // Lineup operations
  async getTeamLineups(teamId: string): Promise<Lineup[]> {
    return db.select().from(lineups).where(eq(lineups.teamId, teamId));
  }

  async createLineup(lineup: InsertLineup & { teamId: string }): Promise<Lineup> {
    const [newLineup] = await db.insert(lineups).values(lineup).returning();
    return newLineup;
  }

  async updateLineup(lineupId: string, data: Partial<InsertLineup>): Promise<Lineup> {
    const [updatedLineup] = await db
      .update(lineups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lineups.id, lineupId))
      .returning();
    return updatedLineup;
  }

  async deleteLineup(lineupId: string): Promise<void> {
    await db.delete(lineups).where(eq(lineups.id, lineupId));
  }
}

export const storage = new DatabaseStorage();
