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

        const IssuerCtor =
            clientModule.Issuer ?? clientModule.default?.Issuer;

        if (typeof IssuerCtor?.discover === "function") {
            const issuerInstance = await IssuerCtor.discover(
                "https://accounts.google.com"
            );

            const legacyClient = new issuerInstance.Client({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uris: [redirect],
                response_types: ["code"],
            });

            return legacyClient as any;
        }

        if (typeof clientModule.discovery === "function") {
            console.debug(
                "openid-client.discovery detected. clientId:",
                String(clientId),
                "redirect:",
                redirect
            );

            try {
                const config = await clientModule.discovery(
                    new URL("https://accounts.google.com"),
                    clientId,
                    clientSecret
                );
                return {
                    mode: "modern",
                    config,
                    module: clientModule,
                } as any;
            } catch (err) {
                console.error("openid-client.discovery failed:", err);
                throw err;
            }
        }

        console.error(
            "openid-client does not expose Issuer.discover or discovery.",
            Object.keys(clientModule)
        );
        throw new Error(
            "Unsupported openid-client API shape; cannot construct OIDC client"
        );
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
    const usePg =
        !!process.env.DATABASE_URL &&
        process.env.DEV_USE_MEMORY_STORE !== "true";

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

    const verify: any = async (
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
            console.error("Error during user upsert in verify:", err);
            verified(err as Error);
        }
    };

    const strategyName = "google";

    const clientModuleForStrategy: any = await import("openid-client");
    let PassportStrategy: any =
        clientModuleForStrategy.Strategy ??
        clientModuleForStrategy.default?.Strategy;

    if (!PassportStrategy) {
        const passportMod: any = await import(
            "openid-client/passport"
        );
        PassportStrategy = passportMod.Strategy;
    }

    let strategy: any;
    const isModern = !!(oidc && (oidc as any).mode === "modern");

    if (isModern) {
        strategy = new PassportStrategy(
            {
                config: (oidc as any).config,
                params: {
                    scope: "openid email profile",
                    redirect_uri: redirectUri,
                    prompt: "consent",
                    access_type: "offline",
                }
            },
            verify
        );
    } else {
        strategy = new PassportStrategy(
            {
                client: oidc as any,
                params: {
                    scope: "openid email profile",
                    redirect_uri: redirectUri,
                    prompt: "consent",
                    access_type: "offline",
                }
            },
            verify
        );
    }

    passport.use(strategyName, strategy);

    passport.serializeUser((user: Express.User, cb) =>
        cb(null, user)
    );
    passport.deserializeUser((user: Express.User, cb) =>
        cb(null, user)
    );

    // LOGIN (authorization request)
    app.get(
        "/api/login",
        passport.authenticate(strategyName, {
            scope: ["openid", "email", "profile"],
        })
    );

    // CALLBACK
    app.get(
        "/api/callback",
        passport.authenticate(strategyName, {
            successReturnToOrRedirect:
                process.env.APP_ORIGIN ?? "/",
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

export const isAuthenticated: RequestHandler = async (
    req,
    res,
    next
) => {
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

        if (oidc && (oidc as any).mode === "modern") {
            tokenResponse = await (oidc as any).module.refreshTokenGrant(
                (oidc as any).config,
                refreshToken as string
            );
        } else {
            tokenResponse = await (oidc as any).refresh(
                refreshToken as string
            );
        }

        user.claims = tokenResponse.claims();
        user.access_token = tokenResponse.access_token;
        user.refresh_token =
            tokenResponse.refresh_token || user.refresh_token;
        user.expires_at = user.claims?.exp;

        return next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized" });
    }
};
