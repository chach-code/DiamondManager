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
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);
