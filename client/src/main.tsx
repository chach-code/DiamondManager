import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Handle GitHub Pages 404.html redirect BEFORE React renders
// This prevents infinite loops in React effects
if (typeof window !== 'undefined') {
  const search = window.location.search;
  const hash = window.location.hash; // CRITICAL: Extract hash BEFORE transforming URL
  
  // Extract JWT token from query params FIRST (more reliable for Safari/GitHub Pages)
  // Token might be in query param due to GitHub Pages URL transformation or direct redirect
  let tokenFromQuery = false;
  if (search) {
    const urlParams = new URLSearchParams(search);
    const authToken = urlParams.get('auth_token');
    if (authToken) {
      try {
        localStorage.setItem('auth_token', decodeURIComponent(authToken));
        console.log("🔑 [main.tsx] JWT token extracted from query parameter");
        tokenFromQuery = true;
      } catch (e) {
        console.error("❌ [main.tsx] Failed to store JWT token from query param:", e);
      }
    }
  }
  
  // Log full URL state for debugging
  console.log("📋 [main.tsx] Initial URL state:", {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: hash.substring(0, 100) + (hash.length > 100 ? '...' : ''), // Log first 100 chars
    hashLength: hash.length,
  });
  
  // Extract JWT token from hash BEFORE URL transformation (hash might be lost during transform)
  // Try multiple parsing methods to handle different URL formats
  if (hash) {
    console.log("🔍 [main.tsx] Processing hash:", {
      hashPreview: hash.substring(0, 200),
      hashFull: hash, // Log full hash for debugging
      hasTokenParam: hash.includes('token=') || hash.includes('token%3D'),
    });
    
    let token: string | null = null;
    
    // Method 1: Try URLSearchParams (standard format: #token=...)
    try {
      const hashParams = new URLSearchParams(hash.substring(1)); // Remove '#' prefix
      token = hashParams.get('token');
      if (token) {
        console.log("✅ [main.tsx] Found token via URLSearchParams");
      }
    } catch (e) {
      console.warn("⚠️ [main.tsx] URLSearchParams parsing failed:", e);
    }
    
    // Method 2: Try manual parsing if URLSearchParams didn't work
    if (!token) {
      const tokenMatch = hash.match(/[#&]token=([^&]+)/) || hash.match(/token%3D([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        token = decodeURIComponent(tokenMatch[1]);
        console.log("✅ [main.tsx] Found token via regex parsing");
      }
    }
    
    // Method 3: If hash looks like a JWT token directly (starts with eyJ)
    if (!token && hash.length > 50 && hash.match(/^#?eyJ[A-Za-z0-9_-]+\./)) {
      token = hash.replace(/^#/, ''); // Remove leading #
      console.log("✅ [main.tsx] Found token as direct JWT in hash");
    }
    
    if (token && !tokenFromQuery) {
      // Only store from hash if we haven't already stored from query param
      // Store JWT token in localStorage for Safari fallback
      try {
        // Verify localStorage is accessible
        const testKey = '__test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
          // Validate token structure (JWT should have 3 parts separated by dots)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          console.error("❌ [main.tsx] Invalid JWT token structure - expected 3 parts, got", tokenParts.length);
        } else {
          // Store the token
          localStorage.setItem('auth_token', token);
          
          // Verify it was stored
          const stored = localStorage.getItem('auth_token');
          if (stored === token) {
            console.log("🔑 [main.tsx] JWT token extracted and stored from URL hash", {
              tokenPreview: token.substring(0, 30) + '...',
              tokenLength: token.length,
              tokenParts: tokenParts.length,
              stored: true,
            });
          } else {
            console.error("❌ [main.tsx] Token storage failed - stored value doesn't match", {
              expectedLength: token.length,
              storedLength: stored?.length || 0,
            });
          }
        }
      } catch (e) {
        console.error("❌ [main.tsx] Failed to store JWT token:", e);
        // Try sessionStorage as fallback
        try {
          sessionStorage.setItem('auth_token', token);
          console.log("⚠️ [main.tsx] Stored token in sessionStorage as fallback");
        } catch (e2) {
          console.error("❌ [main.tsx] Failed to store token in sessionStorage too:", e2);
        }
      }
    } else if (!token && !tokenFromQuery) {
      console.warn("⚠️ [main.tsx] Hash present but no token found using any method", {
        hashPreview: hash.substring(0, 200),
        hashLength: hash.length,
      });
    } else if (token && tokenFromQuery) {
      console.log("ℹ️ [main.tsx] Token already extracted from query param, skipping hash extraction");
    }
  } else {
    console.log("ℹ️ [main.tsx] No hash in URL");
  }
  
  // GitHub Pages 404.html redirect uses ?/path&query format
  // e.g., ?/app&oauth_callback=1~and~t=123
  if (search.startsWith('?/')) {
    console.log("🔄 [main.tsx] Detected 404.html redirect format, transforming URL", {
      originalSearch: search,
      originalHash: hash.substring(0, 50) + (hash.length > 50 ? '...' : ''), // Log first 50 chars of hash
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
    // Also extract JWT token from query params if present (GitHub Pages transforms # to &)
    // Only extract if we haven't already extracted from query params above
    const cleanQueryParts: string[] = [];
    let tokenFromTransformedQuery = false;
    for (const part of queryParts) {
      if (part.startsWith('auth_token=') && !tokenFromQuery) {
        // Extract and store token from query param (if not already stored)
        const tokenMatch = part.match(/auth_token=(.+)$/);
        if (tokenMatch && tokenMatch[1]) {
          try {
            let token = decodeURIComponent(tokenMatch[1].replace(/~and~/g, '&')); // Handle ~and~ encoding
            
            // Validate token structure (JWT should have 3 parts separated by dots)
            const tokenParts = token.split('.');
            if (tokenParts.length !== 3) {
              console.error("❌ [main.tsx] Invalid JWT token structure from query param - expected 3 parts, got", tokenParts.length);
            } else {
              localStorage.setItem('auth_token', token);
              console.log("🔑 [main.tsx] JWT token extracted from transformed query parameter", {
                tokenLength: token.length,
                tokenParts: tokenParts.length,
              });
              tokenFromTransformedQuery = true;
              // Don't include auth_token in final URL (remove from query string)
              continue;
            }
          } catch (e) {
            console.error("❌ [main.tsx] Failed to extract token from transformed query param:", e);
          }
        }
      }
      cleanQueryParts.push(part);
    }
    
    const queryString = cleanQueryParts.length > 0 ? `?${cleanQueryParts.join('&')}` : '';
    
    // Clean up hash - remove token param if we already extracted it
    let cleanHash = hash;
    if (cleanHash && cleanHash.includes('token=')) {
      const hashParams = new URLSearchParams(cleanHash.substring(1));
      hashParams.delete('token');
      const remainingHash = Array.from(hashParams.entries()).map(([k, v]) => `${k}=${v}`).join('&');
      cleanHash = remainingHash ? `#${remainingHash}` : '';
    }
    
    const finalUrl = fullPath + queryString + cleanHash;
    
    console.log("✅ [main.tsx] Transformed URL", {
      pathPart,
      queryParts,
      cleanQueryParts,
      fullPath,
      finalUrl,
      hashExtracted: hash.includes('token='),
      tokenFromQuery: !!tokenFromQuery,
    });
    
    // Update URL to clean format before React renders (hash already processed)
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
  // JWT token extraction happens above (before URL transformation) to ensure it's not lost
  const pathname = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const oauthCallback = urlParams.get('oauth_callback') === '1';
  
  // Verify token was stored (if hash had one)
  const storedToken = localStorage.getItem('auth_token');
  if (oauthCallback && storedToken) {
    console.log("🔑 [main.tsx] JWT token confirmed stored after OAuth callback");
  } else if (oauthCallback && !storedToken) {
    console.warn("⚠️ [main.tsx] OAuth callback detected but no JWT token found in localStorage - cookies may be required");
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
