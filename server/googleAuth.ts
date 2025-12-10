import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import memorystore from "memorystore";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    const config = await client.discovery(new URL("https://accounts.google.com"), process.env.GOOGLE_CLIENT_ID!);
    return config;
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  // If DATABASE_URL is provided and DEV_USE_MEMORY_STORE is not set, use
  // PostgreSQL-backed session store. Otherwise, fall back to an in-memory
  // store (suitable for local development / testing).
  const usePg = !!process.env.DATABASE_URL && process.env.DEV_USE_MEMORY_STORE !== "true";

  if (usePg) {
    const pgStore = connectPg(session);
    const sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
    return session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // Only mark cookie as secure in production (HTTPS). This allows local
        // development over HTTP while keeping cookies secure in deployed envs.
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
      },
    });
  }

  // Fallback: in-memory store (memorystore) for local dev. Not suitable for
  // production, but convenient while developing without a database.
  const MemoryStore = memorystore(session);
  const memoryStore = new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });
  return session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    store: memoryStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims.sub,
    email: claims.email,
    firstName: claims.given_name,
    lastName: claims.family_name,
    profileImageUrl: claims.picture,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    user.claims = tokens.claims();
    user.access_token = tokens.access_token;
    user.refresh_token = tokens.refresh_token;
    user.expires_at = user.claims?.exp;
    await upsertUser(user.claims);
    verified(null, user);
  };

  const strategyName = "google";
  const redirect = process.env.GOOGLE_CALLBACK_URL ?? `${process.env.APP_ORIGIN ?? `http://localhost:${process.env.PORT ?? 5000}`}/api/callback`;

  const strategy = new Strategy(
    {
      name: strategyName,
      config,
      scope: "openid email profile",
      callbackURL: redirect,
    },
    verify,
  );

  passport.use(strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get(
    "/api/login",
    passport.authenticate(strategyName, {
      prompt: "consent",
      scope: ["openid", "email", "profile"],
      // Request offline access so Google returns a refresh token
      access_type: "offline",
    })
  );

  app.get(
    "/api/callback",
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: process.env.APP_ORIGIN ?? "/",
      failureRedirect: "/api/login",
    })
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session?.destroy(() => {
        res.redirect(process.env.APP_ORIGIN ?? "/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    // Update session user with refreshed tokens and claims
    user.claims = tokenResponse.claims();
    user.access_token = tokenResponse.access_token;
    user.refresh_token = tokenResponse.refresh_token || user.refresh_token;
    user.expires_at = user.claims?.exp;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
