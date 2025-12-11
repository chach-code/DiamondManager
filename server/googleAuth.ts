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

// We will rely on runtime structure and use `typeof` and ReturnType for typing
// No external type imports from "openid-client" are necessary now.

// -----------------------------------------------------

export const getOidcConfig = memoize(
  async () => {
    // 1. Dynamic import. Use 'as any' to bypass TS strict checking on the import result.
    const openid = await import("openid-client") as any;
    
    // --- START ISSUER EXTRACTION (Robust logic for bundled/mixed modules) ---
    
    let moduleExports: any = openid;

    // Fallback check for modules bundled under 'default'
    if (moduleExports && typeof moduleExports === 'object' && 'default' in moduleExports) {
        moduleExports = moduleExports.default;
    }
    
    // 2. Use a type assertion to define the type of the Issuer variable
    const Issuer: typeof moduleExports.Issuer = moduleExports.Issuer;
    
    // --- END ISSUER EXTRACTION ---
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    }

    const redirect = getCallbackUrlFromEnv();

    // Always use stable Issuer.discover
    const google = await Issuer.discover("https://accounts.google.com");

    // The return value is a Client instance.
    const client = new google.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirect],
      response_types: ["code"],
    });

    return client;
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

  const client = await getOidcConfig();
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
  const passportMod: any = await import("openid-client/passport");
  // Use a fallback for Strategy extraction
  const Strategy = passportMod.Strategy || passportMod.default?.Strategy; 

  // Stable working strategy config
  passport.use(
    "google",
    new Strategy(
      {
        client,
        params: {
          scope: "openid email profile",
          redirect_uri: redirectUri,
          prompt: "consent",
          access_type: "offline",
        },
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
    })
  );

  // CALLBACK
  app.get(
    "/api/callback",
    passport.authenticate("google", {
      successReturnToOrRedirect: process.env.APP_ORIGIN ?? "/",
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
        res.redirect(process.env.APP_ORIGIN ?? "/");
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
    // ⚠️ FIX: Define the type of the Client dynamically based on getOidcConfig's return type
    type OpenIdClientType = ReturnType<typeof getOidcConfig> extends Promise<infer U> ? U : never;

    // Assert the client has the correct type, allowing access to .refresh()
    const client = (await getOidcConfig()) as OpenIdClientType; 
    
    const refreshed = await client.refresh(refreshToken);

    user.claims = refreshed.claims();
    user.access_token = refreshed.access_token;
    user.refresh_token = refreshed.refresh_token ?? refreshToken;
    user.expires_at = refreshed.claims()?.exp;

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};