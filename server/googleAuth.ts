// Import openid-client dynamically inside the OIDC helper to avoid runtime
// ESM/CJS export shape differences after bundling. We'll resolve `Issuer`
// from either the named export or the default export.
// `openid-client/passport` is imported dynamically inside `setupAuth`
// to avoid loading provider-specific modules during unit tests.

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import memorystore from "memorystore";

export const getOidcConfig = memoize(
  async () => {
    // Dynamically import openid-client to avoid differing export styles
    // between dev and production bundles. We'll prefer the legacy
    // `Issuer.discover(...).Client` shape if available; otherwise use the
    // v6+ `discovery(server, clientId, clientSecret)` API that returns a
    // Configuration instance.
    const clientModule: any = await import('openid-client');

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

    // Try legacy Issuer if present
    const IssuerCtor = clientModule.Issuer ?? clientModule.default?.Issuer;
    if (typeof IssuerCtor?.discover === 'function') {
      const issuerInstance = await IssuerCtor.discover(new URL("https://accounts.google.com"));
      const legacyClient = new issuerInstance.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [redirect],
        response_types: ["code"],
      });
      return { mode: 'legacy', client: legacyClient, module: clientModule } as any;
    }

    // Fallback to modern discovery API (v6+). Log inputs for easier debugging
    // in environments like Render where errors surfaced earlier.
    if (typeof clientModule.discovery === 'function') {
      console.debug('openid-client.discovery detected. clientId:', String(clientId), 'redirect:', redirect);
      try {
        const config = await clientModule.discovery(new URL("https://accounts.google.com"), clientId, clientSecret);
        return { mode: 'modern', config, module: clientModule } as any;
      } catch (err) {
        console.error('openid-client.discovery failed:', err);
        throw err;
      }
    }

    console.error('openid-client does not expose Issuer.discover or discovery. Module keys:', Object.keys(clientModule));
    throw new Error('Unsupported openid-client API shape; cannot construct OIDC client');
  },
  { maxAge: 3600 * 1000 }
);

// A small pure helper that computes the callback URL and validates required
// environment variables. Exported for unit testing so we can validate
// configuration without invoking network or provider discovery.
export function getCallbackUrlFromEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing required env vars: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }

  const redirect = process.env.GOOGLE_CALLBACK_URL ?? `${process.env.BACKEND_ORIGIN ?? process.env.APP_ORIGIN ?? `http://localhost:${process.env.PORT ?? 5000}`}/api/callback`;
  return redirect;
}

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
  // Load storage lazily to avoid requiring the database during unit tests
  const mod = await import('./storage');
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

  const verify: any = async (
    // Use a loose `any` here to avoid runtime/compile mismatches from the
    // underlying openid-client types when compiled and bundled for deploy.
    tokens: any,
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

  // Load the passport strategy dynamically. Prefer a Strategy export from
  // `openid-client` if present (v6+ may export it), otherwise fall back to
  // the `openid-client/passport` entrypoint. This keeps tests free of
  // node_modules ESM parsing until the server is actually started.
  const clientModuleForStrategy: any = await import('openid-client');
  let PassportStrategy: any = clientModuleForStrategy.Strategy ?? clientModuleForStrategy.Strategy;
  if (!PassportStrategy) {
    const passportMod: any = await import('openid-client/passport');
    PassportStrategy = passportMod.Strategy;
  }

  let strategy: any;
  if ((oidc as any).mode === 'legacy') {
    strategy = new PassportStrategy(({ client: (oidc as any).client, params: { scope: "openid email profile" } } as any), verify);
  } else {
    strategy = new PassportStrategy(({ config: (oidc as any).config, params: { scope: "openid email profile" } } as any), verify);
  }

  // Register the strategy explicitly under the `google` name so that
  // `passport.authenticate('google')` always picks the expected strategy.
  passport.use(strategyName, strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get(
    "/api/login",
    passport.authenticate(strategyName, ({
      prompt: "consent",
      scope: ["openid", "email", "profile"],
      // Request offline access so Google returns a refresh token
      access_type: "offline",
    } as any))
  );

  app.get(
    "/api/callback",
    passport.authenticate(strategyName, ({
      successReturnToOrRedirect: process.env.APP_ORIGIN ?? "/",
      failureRedirect: "/api/login",
    } as any))
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
    if ((oidc as any).mode === 'legacy') {
      tokenResponse = await (oidc as any).client.refresh(refreshToken as string);
    } else {
      // modern openid-client: use refreshTokenGrant(config, refreshToken)
      tokenResponse = await (oidc as any).module.refreshTokenGrant((oidc as any).config, refreshToken as string);
    }
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
