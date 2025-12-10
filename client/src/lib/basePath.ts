// Base path configuration for GitHub Pages
// This detects if we're running on GitHub Pages and extracts the base path
export function getBasePath(): string {
  // Check if we're on GitHub Pages by looking at the pathname
  const pathname = window.location.pathname;
  
  // If pathname starts with /DiamondManager/, that's our base path
  if (pathname.startsWith('/DiamondManager/')) {
    return '/DiamondManager';
  }
  
  // Otherwise, no base path (local development or custom domain)
  return '';
}

export function getBasePathWithSlash(): string {
  const base = getBasePath();
  return base ? `${base}/` : '/';
}

// Helper to strip base path from a pathname
export function stripBasePath(pathname: string): string {
  const base = getBasePath();
  if (base && pathname.startsWith(base)) {
    return pathname.slice(base.length) || '/';
  }
  return pathname;
}

// Helper to add base path to a pathname
export function addBasePath(pathname: string): string {
  const base = getBasePath();
  if (!base) return pathname;
  
  // Ensure pathname starts with /
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${cleanPath}`;
}

