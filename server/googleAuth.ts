// googleAuth.ts
// Robust OpenID Connect + Passport setup for Google which ensures
// the OIDC client always contains redirect_uris so Google receives
// redirect_uri in the authorization request.

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import memorystore from "memorystore";

type ModernOidc = {
  mode: "modern";
  client: any; // an openid-client Client-like instance
  module: any;
  config?: any;
};
type LegacyOidc = any; // legacy client instance (Issuer.Client)
type OidcReturn = ModernOidc | LegacyOidc;

export const getOidcConfig = memoize(
  async (): Promise<OidcReturn> => {
    const clientModule: any = await import("openid-client");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "Missing required env vars: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
      );
    }

    const redirect =
      process.env.GOOGLE_CALLBACK_URL ??
      `${process.env.BACKEND_ORIGIN ??
        process.env.APP_ORIGIN ??
        `http://localhost:${process.env.PORT ?? 5000}`}/api/callback`;

    // Prefer Issuer (typical openid-client usage)
    const IssuerCtor = clientModule.Issuer ?? clientModule.default?.Issuer;

    if (typeof IssuerCtor?.discover === "function") {
      // Standard path: discover issuer, then create a client instance that has redirect_uris
      const issuerInstance = await IssuerCtor.discover("https://accounts.google.com");

      const client = new issuerInstance.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [redirect],
        response_types: ["code"],
      });

      // Return the actual client instance (legacy-style). PassportStrategy
      // will accept this as the client and will derive redirect_uri from it.
      return client as any;
    }

    // If Issuer isn't available, see if the modern discovery helper exists.
    // v6+ of openid-client may export `discovery` and a Client constructor.
    if (typeof clientModule.discovery === "function") {
      console.debug(
        "openid-client.discovery detected. clientId:",
        String(clientId),
        "redirect:",
        redirect
      );

      try {
        // discovery returns an issuer/config object for the provider
        const config = await clientModule.discovery(
          new URL("https://accounts.google.com"),
          clientId,
          clientSecret
        );

        // Try to build a Client instance from the module (if it exports one)
        // Prefer clientModule.Client or clientModule.default?.Client
        const ClientCtor = clientModule.Client ?? clientModule.default?.Client;

        if (typeof ClientCtor === "function") {
          // Attempt to instantiate with metadata + the discovered config
          // Many modern shapes accept (metadata, options) or similar.
          const client = new ClientCtor(
            {
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uris: [redirect],
              response_types: ["code"],
            },
            config // pass config if constructor accepts it (harmless if ignored)
          );

          return { mode: "modern", client, module: clientModule, config } as ModernOidc;
        }

        // If we can't construct a client instance, return the discovery config
        // plus the module and the redirect so the caller can construct the client.
        return { mode: "modern", client: null, module: clientModule, config, redirect } as any;
      } catch (err) {
        console.error("openid-client.discovery failed:", err);
        throw err;
      }
    }

    console.error(
      "openid-client does not expose Issuer.discover or discovery. Module keys:",
      Object.keys(clientModule)
    );
    throw new Error("Unsupported openid-client API shape; cannot construct OIDC client");
  },
  { maxAge: 3600 * 1000 }
);

// Computes callback URL
export function getCallbackUrlFromEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing required env vars: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    );
  }

  return (
    process.env.GOOGLE_CALLBACK_URL ??
    `${process.env.BACKEND_ORIGIN ??
      process.env.APP_ORIGIN ??
      `http://localhost:${process.env.PORT ?? 5000}`}/api/callback`
  );
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
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
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
      },
    });
  }

  const MemoryStore = memorystore(session);
  const memoryStore = new MemoryStore({
    checkPeriod: 24 * 60 * 60 * 1000,
  });

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
  const mod = await import("./storage");
  const storage = mod.storage;

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

  const oidc = await getOidcConfig();
  const redirectUri = getCallbackUrlFromEnv();

  // If modern mode returned without a constructed client, try to build one now.
  let clientInstance: any = null;
  if ((oidc as any)?.mode === "modern") {
    const modern = oidc as ModernOidc & { redirect?: string };
    if (modern.client) {
      clientInstance = modern.client;
    } else {
      // try to create a client from the module if possible
      const clientModule = (oidc as any).module;
      const ClientCtor = clientModule?.Client ?? clientModule?.default?.Client;
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      try {
        if (typeof ClientCtor === "function") {
          clientInstance = new ClientCtor(
            {
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uris: [redirectUri],
              response_types: ["code"],
            },
            (oidc as any).config
          );
        } else {
          // if we can't build a real client, create a minimal stub with metadata
          clientInstance = {
            metadata: {
              redirect_uris: [redirectUri],
            },
          };
        }
      } catch (err) {
        console.warn("Could not construct modern client instance; using minimal fallback.", err);
        clientInstance = {
          metadata: {
            redirect_uris: [redirectUri],
          },
        };
      }
    }
  } else {
    // legacy branch: oidc is already a client instance returned by Issuer.Client
    clientInstance = oidc as LegacyOidc;
  }

  const verify: any = async (tokens: any, verified: passport.AuthenticateCallback) => {
    const user: any = {};
    user.claims = typeof tokens?.claims === "function" ? tokens.claims() : tokens;
    user.access_token = tokens?.access_token;
    user.refresh_token = tokens?.refresh_token;
    user.expires_at = user.claims?.exp;

    try {
      await upsertUser(user.claims);
      verified(null, user);
    } catch (err) {
      console.error("Error during user upsert in verify:", err);
      verified(err as Error);
    }
  };

  const strategyName = "google";

  // Load passport Strategy from module (works for both shapes)
  const clientModuleForStrategy: any = await import("openid-client");
  let PassportStrategy: any = clientModuleForStrategy.Strategy ?? clientModuleForStrategy.default?.Strategy;
  if (!PassportStrategy) {
    const passportMod: any = await import("openid-client/passport");
    PassportStrategy = passportMod.Strategy;
  }

  // Build strategy options: prefer passing client instance when available.
  const strategyOptions: any = {};
  if (clientInstance) {
    // openid-client passport strategy accepts { client } or { config }
    strategyOptions.client = clientInstance;
  } else if ((oidc as any).config) {
    strategyOptions.config = (oidc as any).config;
  }

  // Put OAuth-specific params here (prompt, access_type); do NOT put redirect_uri here.
  strategyOptions.params = {
    scope: "openid email profile",
    prompt: "consent",
    access_type: "offline",
  };

  const strategy = new PassportStrategy(strategyOptions, verify);

  passport.use(strategyName, strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // LOGIN (authorization request)
  // Only ask passport to set scope. The strategy will supply redirect_uri from client metadata.
  app.get("/api/login", passport.authenticate(strategyName, { scope: ["openid", "email", "profile"] }));

  // CALLBACK
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
    const oidc = await getOidcConfig();
    let tokenResponse: any;

    if ((oidc as any)?.mode === "modern") {
      // For modern modules we stored client under oidc.client or constructed it earlier
      const modern = oidc as ModernOidc;
      const client = modern.client ?? (modern as any).module?.Client ? modern.client : null;
      if (client && typeof modern.module.refreshTokenGrant === "function") {
        tokenResponse = await modern.module.refreshTokenGrant(modern.config, refreshToken as string);
      } else if (client && typeof client.refresh === "function") {
        tokenResponse = await client.refresh(refreshToken as string);
      } else {
        throw new Error("Unable to refresh token: no refresh implementation available");
      }
    } else {
      // legacy client instance supports refresh()
      tokenResponse = await (oidc as any).refresh(refreshToken as string);
    }

    user.claims = typeof tokenResponse.claims === "function" ? tokenResponse.claims() : tokenResponse;
    user.access_token = tokenResponse.access_token;
    user.refresh_token = tokenResponse.refresh_token || user.refresh_token;
    user.expires_at = user.claims?.exp;

    return next();
  } catch (error) {
    console.error("Error refreshing token in isAuthenticated:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
