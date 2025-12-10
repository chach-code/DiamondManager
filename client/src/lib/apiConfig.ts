// API base URL configuration
// For GitHub Pages, set this to your backend URL (e.g., from Render)
// For local development, leave empty to use relative URLs
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }
  
  // Ensure base URL has trailing slash and path has leading slash
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath.slice(1)}`; // Remove leading slash from path since base has it
}

// Helper for navigation to API endpoints (like login/logout)
export function getApiNavUrl(path: string): string {
  return getApiUrl(path);
}

