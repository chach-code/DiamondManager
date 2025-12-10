# DiamondManager - Baseball Team Manager

A full-stack web application for managing baseball teams, rosters, and generating batting/position lineups.

## Features

- 🏟️ Team roster management
- 📋 Batting lineup generator
- 🎯 Position assignment
- 👤 Guest mode (no sign-in required)
- 🌓 Dark mode support

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express + TypeScript
- **Database**: Drizzle ORM with Neon PostgreSQL
- **Authentication**: Google OAuth

## Free Hosting Setup

This project is configured for free hosting:

### Frontend (GitHub Pages)
The frontend is automatically deployed to GitHub Pages via GitHub Actions.

**To enable:**
1. Go to your repository settings on GitHub
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select "GitHub Actions"
4. The site will be available at: `https://chach-code.github.io/DiamondManager/`

### Backend (Render - Free Tier)
1. Sign up at [render.com](https://render.com) (free)
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Add environment variables (from your `.env`)
6. Get your backend URL (e.g., `https://your-app.onrender.com`)

### Configure Frontend to Use Backend
1. In your GitHub repository, go to Settings → Secrets and variables → Actions
2. Add a new secret: `VITE_API_BASE_URL` = your Render backend URL (e.g., `https://your-app.onrender.com`)
3. The GitHub Actions workflow will use this to build the frontend with the correct API URL

## Local Development

```bash
# Install dependencies
npm install

# Run development server (frontend + backend)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared TypeScript types
└── attached_assets/ # Images and assets
```

## Notes

- The app works in "Guest Mode" without authentication (data stored in browser)
- For full features, sign in with Google (requires backend authentication setup)
- Free tier on Render may spin down after 15 minutes of inactivity (wakes on first request)

