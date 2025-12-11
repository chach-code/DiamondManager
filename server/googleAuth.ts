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
import { createRequire } from "node:module";

// Create require function for CommonJS module loading in ESM
const require = createRequire(import.meta.url);

// -----------------------------------------------------

export const getOidcConfig = memoize(
  async () => {
    // Use createRequire to import CommonJS module - more reliable in bundled ESM
    // This works because openid-client is marked as external, so it's available at runtime
    let openid: any;
    try {
      // Try ESM dynamic import first (works in development/unbundled)
      const esmImport = await import("openid-client");
      // Check if it has the expected structure
      if (esmImport.Issuer || (esmImport.default && esmImport.default.Issuer)) {
        openid = esmImport;
      } else {
        throw new Error("ESM import structure unexpected");
      }
    } catch {
      // Fallback to CommonJS require (works better in bundled production)
      openid = require("openid-client");
    }
    
    // --- START ISSUER EXTRACTION (Final, Simplified, and Robust Logic) ---
    
    let moduleExports: any = openid;

    // Check for the common 'default' nesting first (Bundler/ESM convention)
    if (moduleExports && typeof moduleExports === 'object' && moduleExports.default) {
        moduleExports = moduleExports.default;
    }
    
    // Also check for CommonJS default export
    if (moduleExports && typeof moduleExports === 'object' && moduleExports.__esModule && moduleExports.default) {
        // If it's an ESM wrapper around CJS, check the default
        if (moduleExports.default.Issuer) {
          moduleExports = moduleExports.default;
        }
    }
    
    // The core of the issue:
    // When a bundler wraps a CommonJS library, the named exports (like Issuer) 
    // often end up either on the top level object, or on the object nested under 
    // 'default'. We already checked that.
    //
    // The safest way to access CJS exports after a dynamic import is often 
    // to check the root object's named property, or rely on the final object 
    // being the one that holds the exports.
    
    // Prioritize the property named 'Issuer' from the final resolved exports object
    let Issuer: any = moduleExports.Issuer; 

    // If still missing, check the original imported object, as sometimes 
    // the property is defined but not enumerable and gets missed in the default check.
    if (!Issuer && openid.Issuer) {
        Issuer = openid.Issuer;
    }
    
    // Additional fallback: check all possible paths
    if (!Issuer && typeof openid === 'object') {
      // Try accessing directly - handle both ESM and CommonJS formats
      const openidAny = openid as any;
      Issuer = openidAny?.Issuer || openidAny?.default?.Issuer || openidAny?.default?.default?.Issuer;
      
      // Last resort: check if it's a namespace import
      if (!Issuer && 'default' in openidAny) {
        const defaultExport = openidAny.default;
        if (defaultExport && typeof defaultExport === 'object') {
          Issuer = defaultExport.Issuer || (defaultExport.default && defaultExport.default.Issuer);
        }
      }
    }

    if (typeof Issuer !== 'function') {
      // Re-throw the error with diagnostic info on the structure
      console.error("Failed to find Issuer class. Keys on final moduleExports:", Object.keys(moduleExports || {}));
      console.error("Keys on original imported object:", Object.keys(openid || {}));
      console.error("Type of openid:", typeof openid);
      console.error("Has default property:", 'default' in (openid || {}));
      if (typeof openid === 'object' && openid !== null) {
        console.error("Sample of openid structure:", JSON.stringify(Object.keys(openid).slice(0, 10)));
      }
      throw new Error("Could not find Issuer class in openid-client module structure.");
    }
    
    // Assert type for TS compilation
    const FinalIssuer: typeof Issuer = Issuer;
    
    // --- END ISSUER EXTRACTION ---
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    }

    const redirect = getCallbackUrlFromEnv();

    // Use the correctly extracted Issuer class
    const google = await FinalIssuer.discover("https://accounts.google.com");

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
  let passportMod: any;
  try {
    const esmImport = await import("openid-client/passport");
    passportMod = esmImport;
  } catch {
    // Fallback to CommonJS require
    passportMod = require("openid-client/passport");
  }
  // Use a fallback for Strategy extraction - handle various module formats
  const Strategy = passportMod.Strategy || passportMod.default?.Strategy || passportMod?.default?.default?.Strategy; 

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
    // Define the type of the Client dynamically based on getOidcConfig's return type
    type OpenIdClientType = ReturnType<typeof getOidcConfig> extends Promise<infer U> ? U : never;

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