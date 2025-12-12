import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Handle GitHub Pages 404.html redirect BEFORE React renders
// This prevents infinite loops in React effects
if (typeof window !== 'undefined') {
  const search = window.location.search;
  // GitHub Pages 404.html redirect uses ?/path&query format
  // e.g., ?/app&oauth_callback=1~and~t=123
  if (search.startsWith('?/')) {
    console.log("🔄 [main.tsx] Detected 404.html redirect format, transforming URL", {
      originalSearch: search,
      pathname: window.location.pathname,
      href: window.location.href,
    });
    
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
    
    console.log("✅ [main.tsx] Transformed URL", {
      pathPart,
      queryParts,
      fullPath,
      finalUrl,
    });
    
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
  
  // CRITICAL: Detect OAuth callback redirect and extract JWT token
  // After OAuth, the backend redirects to /app with JWT in URL hash
  const pathname = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const oauthCallback = urlParams.get('oauth_callback') === '1';
  
  // Extract JWT token from URL hash if present (OAuth callback)
  const hash = window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash.substring(1)); // Remove '#' prefix
    const token = hashParams.get('token');
    if (token) {
      // Store JWT token in localStorage for Safari fallback
      try {
        localStorage.setItem('auth_token', token);
        console.log("🔑 [main.tsx] JWT token stored from OAuth callback");
        // Clean up URL hash
        const cleanHash = hash.replace(/#token=[^&]*&?/, '').replace(/^#&/, '#').replace(/^#$/, '');
        const newUrl = window.location.pathname + window.location.search + (cleanHash || '');
        window.history.replaceState(null, '', newUrl);
      } catch (e) {
        console.warn("Failed to store JWT token:", e);
      }
    }
  }
  
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
