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
    const issuer = await client.Issuer.discover("https://accounts.google.com");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing required env vars: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
    }

    // Prefer an explicit callback URL, then a backend origin, then fallback to
    // APP_ORIGIN for local dev. In production you should set either
    // `GOOGLE_CALLBACK_URL` or `BACKEND_ORIGIN` to the URL where the backend
    // is reachable (e.g. https://diamondmanager-backend.onrender.com).
    const redirect = process.env.GOOGLE_CALLBACK_URL ?? `${process.env.BACKEND_ORIGIN ?? process.env.APP_ORIGIN ?? `http://localhost:${process.env.PORT ?? 5000}`}/api/callback`;

    const oidcClient = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirect],
      response_types: ["code"],
    });

    return oidcClient;
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

  const oidcClient = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    user.claims = tokens.claims();
    user.access_token = tokens.access_token;
    user.refresh_token = tokens.refresh_token;
    user.expires_at = user.claims?.exp;
    try {
      await upsertUser(user.claims);
      verified(null, user);
    } catch (err) {
      // If upsertUser or any downstream operation fails, call the passport
      // callback with the error so passport can redirect to failureRedirect
      // instead of allowing an unhandled exception to crash the process.
      console.error("Error during user upsert in verify:", err);
      verified(err as Error);
    }
  };

  const strategyName = "google";

  const strategy = new Strategy(
    {
      client: oidcClient,
      params: { scope: "openid email profile" },
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
    const oidcClient = await getOidcConfig();
    const tokenResponse = await oidcClient.refresh(refreshToken as string);
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
