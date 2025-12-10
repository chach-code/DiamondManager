import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcClient = memoize(
  async () => {
    const issuer = await client.Issuer.discover("https://accounts.google.com");
    const redirect = process.env.GOOGLE_CALLBACK_URL ?? 
      `${process.env.APP_ORIGIN ?? `http://localhost:${process.env.PORT ?? 5000}`}/api/callback`;

    const oauthClient = new issuer.Client({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uris: [redirect],
      response_types: ["code"],
    });

    return { issuer, oauthClient };
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
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

  const { oauthClient } = await getOidcClient();

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
  const strategy = new Strategy(
    {
      client: oauthClient,
      params: { scope: "openid email profile" },
    },
    verify
  );

  passport.use(strategyName, strategy as any);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get(
    "/api/login",
    passport.authenticate(strategyName, { prompt: "consent", scope: ["openid", "email", "profile"] })
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

  // If expired, require re-authentication.
  return res.status(401).json({ message: "Unauthorized" });
};
