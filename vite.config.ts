import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// Removed Replit-specific Vite plugins for GitHub/Render deployment

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"), // Explicitly set public directory
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  base: process.env.GITHUB_PAGES === "true" ? "/DiamondManager/" : "/",
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
