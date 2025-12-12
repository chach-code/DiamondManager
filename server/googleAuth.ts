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

  // Determine if we're in a cross-origin setup (GitHub Pages to Render)
  // When sameSite is 'none', secure MUST be true (browser requirement)
  const isProduction = process.env.NODE_ENV === "production";
  const isCrossOrigin = isProduction || process.env.APP_ORIGIN?.includes('github.io');
  const sameSiteValue: 'none' | 'lax' = isCrossOrigin ? 'none' : 'lax';
  // CRITICAL: When sameSite is 'none', secure MUST be true (browser requirement)
  // Even in dev, if we're testing cross-origin, we need secure: true
  const secureValue = sameSiteValue === 'none' ? true : isProduction;

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
        secure: secureValue, // Must be true when sameSite is 'none'
        maxAge: sessionTtl,
        sameSite: sameSiteValue,
        // Don't set domain - let browser set it automatically for cross-origin cookies
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
      secure: secureValue, // Must be true when sameSite is 'none'
      maxAge: sessionTtl,
      sameSite: sameSiteValue,
      // Don't set domain - let browser set it automatically for cross-origin cookies
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

  // Check if session is authenticated first
  if (!req.isAuthenticated()) {
    console.error("Authentication failed: req.isAuthenticated() returned false");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if user object exists
  if (!user) {
    console.error("Authentication failed: req.user is undefined/null");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // If expires_at is missing but we have a refresh_token, try to refresh to restore it
  // This handles cases where old sessions don't have expires_at stored
  if (!user.expires_at && user.refresh_token) {
    console.log("user.expires_at is missing but refresh_token exists, attempting refresh to restore");
    try {
      const { refreshTokenGrant } = await import("openid-client");
      const config = await getOidcConfig();
      
      const refreshed = await refreshTokenGrant(config, user.refresh_token);

      user.claims = refreshed.claims();
      user.access_token = refreshed.access_token;
      user.refresh_token = refreshed.refresh_token ?? user.refresh_token;
      user.expires_at = refreshed.claims()?.exp;

      // Save the refreshed user back to session
      // This ensures the session is updated with the new expires_at
      if (req.session) {
        req.session.save((err: any) => {
          if (err) {
            console.error("Failed to save session after token refresh:", err);
          }
        });
      }

      // After refresh, continue with normal flow
    } catch (error) {
      console.error("Token refresh failed while restoring expires_at:", error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  // Check if user object has expiration (after potential refresh)
  if (!user.expires_at) {
    console.error("Authentication failed: user.expires_at is missing after refresh attempt", {
      hasUser: !!user,
      hasClaims: !!user.claims,
      hasRefreshToken: !!user.refresh_token,
      userKeys: user ? Object.keys(user) : [],
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);

  // If token hasn't expired, proceed
  if (now <= user.expires_at) {
    return next();
  }

  // Token expired - try to refresh
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.error("Authentication failed: Token expired and no refresh token available. User needs to re-authenticate.", {
      userId: user.claims?.sub,
      hasClaims: !!user.claims,
      expiresAt: user.expires_at,
      now: Math.floor(Date.now() / 1000),
    });
    
    // Clear the invalid session so user can re-authenticate
    // This prevents the user from being stuck with an invalid session
    if (typeof req.logout === 'function') {
      req.logout((err: any) => {
        if (err) {
          console.error("Failed to logout invalid session:", err);
        }
        if (req.session) {
          req.session.destroy((destroyErr: any) => {
            if (destroyErr) {
              console.error("Failed to destroy invalid session:", destroyErr);
            }
          });
        }
      });
    } else if (req.session) {
      // If logout is not available, just destroy the session
      req.session.destroy((destroyErr: any) => {
        if (destroyErr) {
          console.error("Failed to destroy invalid session:", destroyErr);
        }
      });
    }
    
    return res.status(401).json({ 
      message: "Unauthorized",
      // Include a hint that re-authentication is needed
      code: "SESSION_EXPIRED_NO_REFRESH_TOKEN"
    });
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
  } catch (error) {
    // Log refresh error for debugging (but don't expose details to client)
    console.error("Token refresh failed:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};