# Cross-Origin Authentication Guide

## Problem
Frontend hosted on `https://chach-code.github.io` (GitHub Pages)  
Backend hosted on `https://diamondmanager-backend.onrender.com` (Render)

Safari blocks third-party cookies due to Intelligent Tracking Prevention (ITP), making cookie-based authentication unreliable.

## Solution: JWT Token in Authorization Header

This is the **standard documented approach** for cross-origin authentication when cookies are blocked.

### Implementation

1. **Backend generates JWT token** after OAuth callback
2. **Token included in redirect URL** (hash + query param for redundancy)
3. **Frontend extracts token** and stores in localStorage
4. **Frontend sends token** in `Authorization: Bearer <token>` header on all API requests
5. **Backend verifies token** and authenticates user

### Key Components

#### Frontend (`client/src/lib/authToken.ts`)
- Stores JWT token in localStorage
- Provides `getAuthToken()` and `shouldUseTokenAuth()` functions

#### Frontend (`client/src/lib/queryClient.ts`)
- **All API requests** include Authorization header if token exists
- `getQueryFn()` - for GET requests (React Query)
- `apiRequest()` - for POST/PATCH/DELETE requests

#### Backend (`server/routes.ts` & `server/googleAuth.ts`)
- `/api/auth/user` - Accepts both cookies and JWT tokens
- `isAuthenticated` middleware - Hybrid auth (cookie first, JWT fallback)
- CORS configured to allow Authorization header

### CORS Configuration

```typescript
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // Required for cookies (when available)
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Authorization for JWT
  exposedHeaders: ['X-Session-Id', 'X-User-Id'],
}));
```

### Security Considerations

✅ **Current Implementation:**
- JWT tokens stored in localStorage (accessible to JavaScript)
- Tokens sent via Authorization header (not vulnerable to CSRF)
- Short expiration times (7 days, same as session)
- HTTPS required for production

⚠️ **Trade-offs:**
- localStorage is accessible to XSS attacks (mitigated by React's built-in XSS protection)
- Cookies are blocked by Safari ITP anyway, so localStorage is the practical choice
- Authorization header is not sent automatically like cookies (but we handle this in code)

### Debugging

#### Frontend Logs (Safari Console)
- `🔑 [main.tsx] JWT token extracted` - Token stored successfully
- `🔑 [queryClient] Including JWT token` - Token being sent in request
- `📡 [queryClient] Making request` - API call details
- `🔍 [useTeams] shouldFetchTeams` - Query enabled status

#### Backend Logs (Render)
- `🔑 [isAuthenticated] JWT verification successful` - Token verified
- `🔍 [isAuthenticated] Checking JWT token auth` - Middleware running
- `❌ [isAuthenticated] Authentication failed` - Check why (missing header, invalid token, etc.)

### Testing Locally

Use Playwright tests in `e2e/oauth-safari-jwt.spec.ts` to test cross-origin JWT flow.

### References

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Safari ITP Documentation](https://webkit.org/tracking-prevention/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
