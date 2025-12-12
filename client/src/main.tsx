import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Handle GitHub Pages 404.html redirect BEFORE React renders
// This prevents infinite loops in React effects
if (typeof window !== 'undefined') {
  const search = window.location.search;
  // GitHub Pages 404.html redirect uses ?/path&query format
  // e.g., ?/DiamondManager/app&oauth_callback=1~and~t=123
  if (search.startsWith('?/')) {
    const fullQuery = search.slice(2).replace(/~and~/g, '&');
    const [pathPart, ...queryParts] = fullQuery.split('&');
    
    // Extract path
    // The 404.html script converts /DiamondManager/app to ?/app (keeping base separate)
    // So pathPart will be just 'app', not '/DiamondManager/app'
    const cleanRoute = pathPart;
    const pathname = window.location.pathname;
    // Base path is already in pathname (e.g., /DiamondManager)
    const base = pathname.startsWith('/DiamondManager') ? '/DiamondManager' : '';
    // Construct full path: base + route
    const fullPath = base && cleanRoute 
      ? `${base}${cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`}`
      : cleanRoute 
        ? (cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`)
        : pathname;
    
    // Preserve query parameters (excluding the path part)
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const finalUrl = fullPath + queryString;
    
    // Update URL to clean format before React renders
    window.history.replaceState(null, '', finalUrl);
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
  const urlParams = new URLSearchParams(window.location.search);
  const oauthCallback = urlParams.get('oauth_callback') === '1';
  
  if (pathname.includes('/app')) {
    // Check if this is a fresh page load (not a navigation)
    // Fresh loads on /app likely mean we came from OAuth redirect
    const oauthRedirect = sessionStorage.getItem('oauth_redirect');
    if (!oauthRedirect || oauthCallback) {
      // Set a flag that we can check in useAuth to force refetch
      // Use timestamp to ensure we only trigger once
      sessionStorage.setItem('oauth_redirect', Date.now().toString());
      console.log("🚀 [main.tsx] OAuth redirect detected, setting flag", {
        pathname,
        oauthCallback,
        hasExistingFlag: !!oauthRedirect,
      });
    }
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);
