import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTeamSchema, insertPlayerSchema, insertLineupSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth endpoint to get current user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user || null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Team routes
  app.get("/api/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten() });
      }

      const team = await storage.createTeam({
        ...parsed.data,
        userId,
      });
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertTeamSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten() });
      }

      const team = await storage.updateTeam(req.params.id, parsed.data);
      res.json(team);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Player routes
  app.get("/api/teams/:teamId/players", isAuthenticated, async (req: any, res) => {
    try {
      const players = await storage.getTeamPlayers(req.params.teamId);
      res.json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  app.post("/api/teams/:teamId/players", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten() });
      }

      const player = await storage.createPlayer({
        ...parsed.data,
        teamId: req.params.teamId,
      });
      res.status(201).json(player);
    } catch (error) {
      console.error("Error creating player:", error);
      res.status(500).json({ message: "Failed to create player" });
    }
  });

  app.patch("/api/players/:id", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertPlayerSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten() });
      }

      const player = await storage.updatePlayer(req.params.id, parsed.data);
      res.json(player);
    } catch (error) {
      console.error("Error updating player:", error);
      res.status(500).json({ message: "Failed to update player" });
    }
  });

  app.delete("/api/players/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deletePlayer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting player:", error);
      res.status(500).json({ message: "Failed to delete player" });
    }
  });

  // Lineup routes
  app.get("/api/teams/:teamId/lineups", isAuthenticated, async (req: any, res) => {
    try {
      const lineups = await storage.getTeamLineups(req.params.teamId);
      res.json(lineups);
    } catch (error) {
      console.error("Error fetching lineups:", error);
      res.status(500).json({ message: "Failed to fetch lineups" });
    }
  });

  app.post("/api/teams/:teamId/lineups", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertLineupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten() });
      }

      const lineup = await storage.createLineup({
        ...parsed.data,
        teamId: req.params.teamId,
      });
      res.status(201).json(lineup);
    } catch (error) {
      console.error("Error creating lineup:", error);
      res.status(500).json({ message: "Failed to create lineup" });
    }
  });

  app.patch("/api/lineups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertLineupSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten() });
      }

      const lineup = await storage.updateLineup(req.params.id, parsed.data);
      res.json(lineup);
    } catch (error) {
      console.error("Error updating lineup:", error);
      res.status(500).json({ message: "Failed to update lineup" });
    }
  });

  app.delete("/api/lineups/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteLineup(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lineup:", error);
      res.status(500).json({ message: "Failed to delete lineup" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
