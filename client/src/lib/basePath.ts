// Base path configuration for GitHub Pages
// This detects if we're running on GitHub Pages and extracts the base path
export function getBasePath(): string {
  // Check if we're on GitHub Pages by looking at the pathname
  const pathname = window.location.pathname;
  
  // If pathname starts with /DiamondManager/, that's our base path
  if (pathname.startsWith('/DiamondManager/')) {
    return '/DiamondManager';
  }
  
  // Also check if we're at /DiamondManager (without trailing slash)
  if (pathname === '/DiamondManager') {
    return '/DiamondManager';
  }
  
  // Otherwise, no base path (local development or custom domain)
  return '';
}

// Handle GitHub Pages 404.html redirect format (?/path)
export function getRouteFromQuery(): string | null {
  const search = window.location.search;
  // GitHub Pages 404.html redirect uses ?/path format
  if (search.startsWith('?/')) {
    // Extract the path from ?/path
    let route = search.slice(2); // Remove '?/'
    // Clean up any encoded characters and restore & to ~and~
    route = route.replace(/~and~/g, '&');
    // Remove query parameters that might have been encoded
    const queryIndex = route.indexOf('&');
    if (queryIndex > 0) {
      route = route.slice(0, queryIndex);
    }
    return route;
  }
  return null;
}

export function getBasePathWithSlash(): string {
  const base = getBasePath();
  return base ? `${base}/` : '/';
}

// Helper to strip base path from a pathname
export function stripBasePath(pathname: string): string {
  const base = getBasePath();
  if (base && pathname.startsWith(base)) {
    const stripped = pathname.slice(base.length);
    // Handle both /path and just path
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return pathname || '/';
}

// Helper to add base path to a pathname
export function addBasePath(pathname: string): string {
  const base = getBasePath();
  if (!base) return pathname;
  
  // Ensure pathname starts with /
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${cleanPath}`;
}

