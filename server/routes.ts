import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./googleAuth";
import { insertTeamSchema, insertPlayerSchema, insertLineupSchema, type InsertTeam, type InsertPlayer, type InsertLineup } from "@shared/schema";
import jwt from "jsonwebtoken";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth endpoint to get current user
  // Don't use isAuthenticated middleware here - return null if not authenticated
  // This allows the frontend to check auth status without redirecting
  // Supports both cookie-based and JWT token-based auth
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      let userId: string | undefined;
      let authMethod: string = 'none';
      
      // Try session cookie auth first
      if (req.isAuthenticated && typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
        userId = req.user.claims?.sub;
        authMethod = 'cookie';
        console.log("🔍 [routes] /api/auth/user: Cookie auth successful, userId:", userId);
      } else {
        // Fall back to JWT token auth (for Safari cookie issues)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const jwtSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-secret';
          
          console.log("🔑 [routes] /api/auth/user: Attempting JWT verification", {
            hasToken: !!token,
            tokenLength: token.length,
            tokenPreview: token.substring(0, 50) + '...',
            jwtSecretLength: jwtSecret.length,
            jwtSecretPreview: jwtSecret.substring(0, 10) + '...',
            hasJwtVerify: typeof jwt.verify === 'function',
          });
          
          try {
            const decoded = jwt.verify(token, jwtSecret) as any;
            console.log("✅ [routes] /api/auth/user: JWT verification successful", {
              decodedKeys: Object.keys(decoded || {}),
              userId: decoded?.userId,
              email: decoded?.email,
              iat: decoded?.iat,
              exp: decoded?.exp,
              expired: decoded?.exp ? Date.now() / 1000 > decoded.exp : null,
            });
            
            userId = decoded.userId;
            authMethod = 'jwt';
          } catch (err: any) {
            // JWT invalid or expired
            console.error("❌ [routes] /api/auth/user: JWT verification failed", {
              error: err.message,
              name: err.name,
              expiredAt: err.expiredAt,
              tokenPreview: token.substring(0, 50) + '...',
            });
          }
        } else {
          console.log("🔍 [routes] /api/auth/user: No Authorization header found");
        }
      }

      if (!userId) {
        console.log("⚠️ [routes] /api/auth/user: No userId found, returning null", { authMethod });
        return res.json(null);
      }

      console.log("🔍 [routes] /api/auth/user: Fetching user from database", { userId, authMethod });
      const user = await storage.getUser(userId);
      if (user) {
        console.log("✅ [routes] /api/auth/user: User found", { userId, email: user.email });
      } else {
        console.warn("⚠️ [routes] /api/auth/user: User not found in database", { userId });
      }
      res.json(user || null);
    } catch (error) {
      console.error("❌ [routes] /api/auth/user: Error fetching user:", error);
      // Return null on error rather than 500, so frontend can handle gracefully
      res.json(null);
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
      } as InsertTeam & { userId: string });
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
      } as InsertPlayer & { teamId: string });
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
      } as InsertLineup & { teamId: string });
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

  // Debug endpoint to inspect session and user data (available in all environments for troubleshooting)
  app.get("/api/debug/session", (req: any, res) => {
    try {
      // Return session and user info for debugging authentication issues
      // Note: This exposes session structure but not sensitive tokens
      const session = req.session || null;
      const user = req.user || null;
      const isAuthenticated = req.isAuthenticated ? req.isAuthenticated() : false;
      
      // Enhanced debugging info for mobile Safari
      const debugInfo = { 
        isAuthenticated,
        hasSession: !!req.session,
        hasUser: !!req.user,
        sessionId: req.sessionID,
        cookieHeader: req.headers.cookie || 'none',
        cookieInfo: req.session?.cookie ? {
          secure: req.session.cookie.secure,
          sameSite: req.session.cookie.sameSite,
          httpOnly: req.session.cookie.httpOnly,
          maxAge: req.session.cookie.maxAge,
        } : null,
        user: user ? {
          hasClaims: !!user.claims,
          hasExpiresAt: !!user.expires_at,
          hasRefreshToken: !!user.refresh_token,
          expiresAt: user.expires_at,
          userId: user.claims?.sub,
          email: user.claims?.email,
          userKeys: Object.keys(user),
        } : null,
        sessionKeys: session ? Object.keys(session) : [],
        headers: {
          origin: req.get('origin'),
          referer: req.get('referer'),
          userAgent: req.get('user-agent')?.substring(0, 100),
        },
        timestamp: new Date().toISOString(),
      };
      
      console.log("🔍 [DEBUG] Session debug endpoint called:", JSON.stringify(debugInfo, null, 2));
      res.json(debugInfo);
    } catch (err) {
      console.error("❌ [DEBUG] Debug endpoint error:", err);
      res.status(500).json({ message: "Debug endpoint failed", error: String(err) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
