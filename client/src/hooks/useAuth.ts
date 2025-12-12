import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const [isGuestMode, setGuestModeState] = useState(() => {
    // Initialize from localStorage on mount
    // Safari might throw an error if localStorage is not available (private mode, etc.)
    try {
      return localStorage.getItem("guestMode") === "true";
    } catch (e) {
      console.warn("localStorage not available, defaulting to guest mode:", e);
      return true;
    }
  });

  // Wrapper to persist guest mode to localStorage
  // Memoized to prevent unnecessary re-renders and make it safe for useEffect dependencies
  const setIsGuestMode = useCallback((value: boolean) => {
    try {
      if (value) {
        localStorage.setItem("guestMode", "true");
      } else {
        localStorage.removeItem("guestMode");
      }
    } catch (e) {
      console.warn("Failed to update localStorage:", e);
      // Still update state even if localStorage fails
    }
    setGuestModeState(value);
  }, []);

  // ALWAYS check for authentication, even in guest mode
  // This ensures we detect when user logs in via OAuth
  // Use returnNull behavior so 401 (not logged in) returns null instead of throwing
  // Custom query function with detailed logging for mobile Safari debugging
  const authQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const path = queryKey.join("/") as string;
    const { getApiUrl } = await import("@/lib/apiConfig");
    const apiUrl = getApiUrl(path);
    
    try {
      // Log request details
      const logData = {
        url: apiUrl,
        hasCookies: typeof document !== 'undefined' ? document.cookie.length > 0 : false,
        cookieCount: typeof document !== 'undefined' ? document.cookie.split(';').length : 0,
        cookies: typeof document !== 'undefined' ? document.cookie.substring(0, 200) : 'N/A', // First 200 chars
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'N/A',
        timestamp: new Date().toISOString(),
      };
      console.log("🔍 [useAuth] Checking auth status:", logData);
      
      const res = await fetch(apiUrl, {
        credentials: "include", // CRITICAL: Must include credentials for cookies
        cache: "no-cache",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      // Log response details
      console.log("📡 [useAuth] Auth check response:", {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        url: res.url,
      });

      if (res.status === 401) {
        console.log("❌ [useAuth] Auth check returned 401 - not authenticated");
        return null;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ [useAuth] Auth check failed:", res.status, text);
        throw new Error(`${res.status}: ${text}`);
      }

      const userData = await res.json();
      console.log("✅ [useAuth] Auth check result:", userData ? { 
        id: userData.id, 
        email: userData.email,
        firstName: userData.firstName,
      } : null);
      return userData;
    } catch (error) {
      console.error("❌ [useAuth] Auth check error:", error);
      if (error instanceof Error && error.message.includes('401')) {
        return null;
      }
      throw error;
    }
  };

  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: authQueryFn,
    retry: false,
    // Always enabled - we need to check auth status even if guest mode is set
    enabled: true,
    // Refetch on mount to catch auth changes after OAuth redirect
    refetchOnMount: true,
    // Don't refetch on window focus - can cause issues
    refetchOnWindowFocus: false,
    // CRITICAL for Safari/mobile: Don't cache auth status
    // Safari aggressively caches responses, so we need fresh checks after OAuth redirect
    staleTime: 0, // Always consider stale - force fresh check
    gcTime: 0, // Don't cache in memory
  });

  // CRITICAL: Force refetch after OAuth redirect on mobile Safari
  // Safari and some mobile browsers cache responses aggressively
  // After OAuth redirect, we need to force a fresh auth check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if we're on /app path (likely after OAuth redirect)
    const pathname = window.location.pathname;
    const isAppPath = pathname.includes('/app');
    
    // Check URL params for OAuth callback indicator
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCallback = urlParams.get('oauth_callback') === '1';
    
    // Check sessionStorage flag
    const oauthRedirectFlag = sessionStorage.getItem('oauth_redirect');
    const hasOAuthFlag = oauthRedirectFlag !== null;
    
    // Log for debugging
    console.log("🔍 OAuth redirect detection:", {
      pathname,
      isAppPath,
      oauthCallback,
      hasOAuthFlag,
      isLoading,
      hasCookies: document.cookie.length > 0,
      cookies: document.cookie,
    });
    
    if (isAppPath && !isLoading) {
      // Clear the OAuth redirect flag after checking
      if (hasOAuthFlag) {
        sessionStorage.removeItem('oauth_redirect');
      }
      
      // Clear URL params after reading
      if (oauthCallback) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
      
      // After redirect, give server time to set session cookie, then refetch
      // This is especially important on Safari which may not send cookies immediately
      // Use longer delay on mobile Safari to account for slower cookie propagation
      const isOAuthRedirect = oauthCallback || hasOAuthFlag;
      const delay = isOAuthRedirect ? 1500 : 300; // Longer delay after OAuth redirect for mobile Safari
      
      console.log(`⏳ Scheduling auth refetch in ${delay}ms (OAuth redirect: ${isOAuthRedirect})`);
      
      const timer = setTimeout(() => {
        console.log("🔄 Forcing auth refetch after OAuth redirect");
        refetch();
        
        // Also try multiple refetches for mobile Safari (cookies may take time to propagate)
        if (isOAuthRedirect) {
          setTimeout(() => {
            console.log("🔄 Second auth refetch for mobile Safari");
            refetch();
          }, 2000);
          
          setTimeout(() => {
            console.log("🔄 Third auth refetch for mobile Safari");
            refetch();
          }, 4000);
        }
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, refetch]); // Only run on mount or when loading state changes

  // If we get a user, clear guest mode
  useEffect(() => {
    if (user && isGuestMode) {
      // setIsGuestMode now handles localStorage removal internally
      setIsGuestMode(false);
      // Don't call refetch() here - React Query will automatically update
      // and calling refetch could cause infinite loops
    }
  }, [user, isGuestMode, setIsGuestMode]);

  // If user is authenticated, override guest mode
  const finalIsGuestMode = user ? false : isGuestMode;

  return {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    isGuestMode: finalIsGuestMode,
    setIsGuestMode,
  };
}
