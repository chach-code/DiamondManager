# Local Development Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in the root directory with:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require
   SESSION_SECRET=your-session-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   # Optional: override callback URL
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/callback
   PORT=5000
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Frontend + Backend: http://localhost:5000
   - The app will run with hot-reload enabled

## Testing GitHub Pages Build Locally

To test the exact build that will be deployed to GitHub Pages:

1. **Build the frontend with GitHub Pages base path:**
   ```bash
   GITHUB_PAGES=true npm run build:frontend
   ```

2. **Serve the built files:**
   
   You can use a simple HTTP server. Install one if needed:
   ```bash
   # Using Python (usually pre-installed)
   cd dist/public
   python3 -m http.server 8080
   
   # Or using Node.js http-server
   npx http-server dist/public -p 8080
   ```

3. **Open in browser:**
   - http://localhost:8080/DiamondManager/
   - This simulates the GitHub Pages environment

## Comparing Local vs GitHub Pages

### Local Development (npm run dev)
- **URL**: http://localhost:5000
- **Base Path**: `/` (no base path)
- **Backend**: Runs locally on port 5000
- **Hot Reload**: Yes
- **API Calls**: Relative URLs (e.g., `/api/auth/user`)

### GitHub Pages Production
- **URL**: https://chach-code.github.io/DiamondManager/
- **Base Path**: `/DiamondManager/`
- **Backend**: https://diamondmanager-backend.onrender.com
- **Hot Reload**: No
- **API Calls**: Full URLs (e.g., `https://diamondmanager-backend.onrender.com/api/auth/user`)

## Troubleshooting

### Port Already in Use
If port 5000 is already in use, you can change it:
```bash
PORT=3000 npm run dev
```

### Database Connection Issues
- Make sure your `.env` file has the correct `DATABASE_URL`
- Check that your Neon database is accessible

### CORS Issues
- Local development should work fine (same origin)
- If testing with a different port, you may need to update CORS settings in `server/app.ts`

## Development Tips

1. **Guest Mode**: Works without backend - data stored in browser localStorage
2. **Authentication**: Local development requires setting up Google OAuth credentials and callback URL; use Guest Mode for quick testing
3. **Database**: Uses your Neon database (same as production)
4. **Hot Reload**: Changes to frontend code will auto-reload in browser



