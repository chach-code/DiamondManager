/**
 * JWT Token management for hybrid auth (cookie + JWT fallback)
 * Used primarily for Safari which has cookie issues
 */

const TOKEN_KEY = 'auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.warn("Failed to get auth token from localStorage:", e);
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn("Failed to store auth token in localStorage:", e);
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn("Failed to clear auth token from localStorage:", e);
  }
}

/**
 * Check if we should use JWT token auth (Safari fallback)
 * Returns true if:
 * 1. We're on Safari
 * 2. OR we have a token stored (indicating cookie auth failed)
 */
export function shouldUseTokenAuth(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  // Check if we have a token stored
  const hasToken = !!getAuthToken();
  
  // Detect Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Use token auth if Safari OR if we have a stored token (cookie auth failed)
  return isSafari || hasToken;
}
