import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Handle GitHub Pages 404.html redirect BEFORE React renders
// This prevents infinite loops in React effects
if (typeof window !== 'undefined') {
  const search = window.location.search;
  // GitHub Pages 404.html redirect uses ?/path format
  if (search.startsWith('?/')) {
    const route = search.slice(2).replace(/~and~/g, '&');
    // Remove query parameters
    const cleanRoute = route.split('&')[0];
    const pathname = window.location.pathname;
    const base = pathname.startsWith('/DiamondManager') ? '/DiamondManager' : '';
    const fullPath = base && cleanRoute ? `${base}${cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`}` : pathname;
    
    // Update URL to clean format before React renders
    window.history.replaceState(null, '', fullPath);
  }
}

// Diagnostic logging for Safari debugging
if (typeof window !== 'undefined') {
  console.log('🚀 App starting...', {
    userAgent: navigator.userAgent,
    pathname: window.location.pathname,
    href: window.location.href,
    hasRoot: !!document.getElementById("root"),
  });
  
  // CRITICAL: Detect OAuth callback redirect
  // After OAuth, the backend redirects to /app
  // We need to ensure React Query refetches auth status
  // Store a flag to indicate we just redirected from OAuth
  const pathname = window.location.pathname;
  if (pathname.includes('/app')) {
    // Check if this is a fresh page load (not a navigation)
    // Fresh loads on /app likely mean we came from OAuth redirect
    const oauthRedirect = sessionStorage.getItem('oauth_redirect');
    if (!oauthRedirect) {
      // Set a flag that we can check in useAuth to force refetch
      // Use timestamp to ensure we only trigger once
      sessionStorage.setItem('oauth_redirect', Date.now().toString());
    }
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);
