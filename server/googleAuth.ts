// ----------------------------
// Google OAuth – Stable Version
// Always uses Issuer.discover()
// Fully compatible with passport
// ----------------------------

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import memorystore from "memorystore";

// -----------------------------------------------------

export const getOidcConfig = memoize(
  async () => {
    // openid-client v6 uses 'discovery' function instead of Issuer.discover()
    // Dynamic import works since the package is marked as external in esbuild
    const { discovery, ClientSecretPost } = await import("openid-client");
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    }

    // Use the new v6 API: discovery() returns a Configuration object
    // The Configuration can be used directly with passport strategies
    const config = await discovery(
      new URL("https://accounts.google.com"),
      clientId,
      clientSecret, // metadata - can be a string (client_secret) or ClientMetadata object
      ClientSecretPost(clientSecret), // clientAuthentication
    );

    return config;
  },
  { maxAge: 3600 * 1000 }
);

// -----------------------------------------------------

export function getCallbackUrlFromEnv() {
  return (
    process.env.GOOGLE_CALLBACK_URL ??
    `${process.env.BACKEND_ORIGIN ??
      process.env.APP_ORIGIN ??
      `http://localhost:${process.env.PORT ?? 5000}`
    }/api/callback`
  );
}

// Get the frontend URL after successful auth
export function getFrontendRedirectUrl(): string {
  const appOrigin = process.env.APP_ORIGIN || 'https://chach-code.github.io';
  
  // For production (GitHub Pages), append /DiamondManager/app
  if (appOrigin.includes('github.io')) {
    return `${appOrigin}/DiamondManager/app`;
  }
  
  // For local dev or other environments
  if (appOrigin.includes('localhost')) {
    return `${appOrigin}/app`;
  }
  
  // Default fallback
  return `${appOrigin}/DiamondManager/app`;
}

// -----------------------------------------------------

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const usePg =
    !!process.env.DATABASE_URL &&
    process.env.DEV_USE_MEMORY_STORE !== "true";

  if (usePg) {
    const pgStore = connectPg(session);
    const store = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });

    return session({
      secret: process.env.SESSION_SECRET!,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
        // For cross-origin (GitHub Pages to Render), need sameSite: 'none'
        sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
      },
    });
  }

  const MemoryStore = memorystore(session);
  const store = new MemoryStore({
    checkPeriod: 24 * 60 * 60 * 1000,
  });

  return session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      // For cross-origin (GitHub Pages to Render), need sameSite: 'none'
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
    },
  });
}

// -----------------------------------------------------

async function upsertUser(claims: any) {
  const mod = await import("./storage");
  await mod.storage.upsertUser({
    id: claims.sub,
    email: claims.email,
    firstName: claims.given_name,
    lastName: claims.family_name,
    profileImageUrl: claims.picture,
  });
}

// -----------------------------------------------------

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();
  const redirectUri = getCallbackUrlFromEnv();

  const verify: any = async (
    tokens: any,
    done: passport.AuthenticateCallback
  ) => {
    const user: any = {
      claims: tokens.claims(),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.claims()?.exp,
    };

    try {
      await upsertUser(user.claims);
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  };

  // Import PassportStrategy from openid-client/passport
  const { Strategy } = await import("openid-client/passport");

  // v6 API: Strategy expects 'config' (Configuration object) and callbackURL at top level
  // Note: prompt and other params are passed via passport.authenticate() options, not here
  passport.use(
    "google",
    new Strategy(
      {
        config: config, // Configuration object returned by discovery()
        callbackURL: redirectUri, // v6 uses callbackURL at top level
        scope: "openid email profile",
      },
      verify
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  // LOGIN
  app.get(
    "/api/login",
    passport.authenticate("google", {
      scope: ["openid", "email", "profile"],
      prompt: "consent", // Pass prompt here via authenticate options
    })
  );

  // CALLBACK
  app.get(
    "/api/callback",
    passport.authenticate("google", {
      successReturnToOrRedirect: getFrontendRedirectUrl(),
      failureRedirect: "/api/login",
    })
  );

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) { 
        console.error("Logout failed:", err);
        return res.status(500).send("Logout failed");
      }
      req.session?.destroy(() => {
        // Redirect to landing page on logout
        const appOrigin = process.env.APP_ORIGIN || 'https://chach-code.github.io';
        const redirectUrl = appOrigin.includes('github.io') 
          ? `${appOrigin}/DiamondManager/`
          : `${appOrigin}/`;
        res.redirect(redirectUrl);
      });
    });
  });
}

// -----------------------------------------------------

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);

  if (now <= user.expires_at) return next();

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // In v6, Configuration has refreshTokenGrant method
    const { refreshTokenGrant } = await import("openid-client");
    const config = await getOidcConfig();
    
    const refreshed = await refreshTokenGrant(config, refreshToken);

    user.claims = refreshed.claims();
    user.access_token = refreshed.access_token;
    user.refresh_token = refreshed.refresh_token ?? refreshToken;
    user.expires_at = refreshed.claims()?.exp;

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};