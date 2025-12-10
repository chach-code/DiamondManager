# Render Environment Variables Setup

## Step 1: Get a Free Database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Click "Create Project"
3. Name it: `diamondmanager` (or any name)
4. Click "Create Project"
5. Copy the connection string (it looks like: `postgresql://user:password@host/database?sslmode=require`)
6. This is your `DATABASE_URL`

## Step 2: Generate a Session Secret

Run this command in your terminal to generate a random secret:

```bash
openssl rand -base64 32
```

Or use this online generator: https://generate-secret.vercel.app/32

Copy the generated string - this is your `SESSION_SECRET`

## Step 3: Add Environment Variables in Render

In your Render dashboard, go to your web service → Environment tab, and add these **exact** variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_UscCMPlIZ97y@ep-still-snow-adag1fx7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Your Neon connection string |
| `SESSION_SECRET` | `m3huWCGSPIwvZFGxRL0NgAptCL9j0w+rX+Dc041iEXA=` | Random 32+ character string |
| `GOOGLE_CLIENT_ID` | `your-google-client-id` | OAuth client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | `your-google-client-secret` | OAuth client secret from Google Cloud |

### Copy-Paste Values:

**DATABASE_URL:**
```
postgresql://neondb_owner:npg_UscCMPlIZ97y@ep-still-snow-adag1fx7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**SESSION_SECRET:**
```
m3huWCGSPIwvZFGxRL0NgAptCL9j0w+rX+Dc041iEXA=
```

**GOOGLE_CLIENT_ID:**
```
your-google-client-id
```

**GOOGLE_CLIENT_SECRET:**
```
your-google-client-secret
```

## Important Notes

- **Authentication**: The server now uses Google OAuth. Configure OAuth credentials in Google Cloud and set the correct callback URL (`GOOGLE_CALLBACK_URL`) to match your deployment origin.
- **Guest mode will work fine** - users can use the app without signing in
- The app will store data in the browser's localStorage in guest mode

## Testing

After deploying:
- The backend should start successfully
- Guest mode on the frontend will work
- Sign-in buttons should work if Google OAuth is configured correctly

