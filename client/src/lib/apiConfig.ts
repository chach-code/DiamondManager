// API base URL configuration
// For GitHub Pages, set this to your backend URL (e.g., from Render)
// For local development, leave empty to use relative URLs
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function getApiUrl(path: string): string {
  // Remove leading slash if API_BASE_URL is set (it will have trailing slash)
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : path;
}

// Helper for navigation to API endpoints (like login/logout)
export function getApiNavUrl(path: string): string {
  return getApiUrl(path);
}

