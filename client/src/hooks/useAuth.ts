import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  
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
      // CRITICAL: Handle CORS errors and network failures gracefully
      // Don't throw - return null to prevent infinite retry loops
      if (error instanceof TypeError && (
        error.message.includes('fetch') || 
        error.message.includes('CORS') ||
        error.message.includes('Failed to fetch')
      )) {
        console.warn("⚠️ [useAuth] Network/CORS error - returning null to prevent loop:", error.message);
        return null; // Return null instead of throwing to prevent React Query from retrying
      }
      
      console.error("❌ [useAuth] Auth check error:", error);
      if (error instanceof Error && error.message.includes('401')) {
        return null;
      }
      // For other errors, still return null to prevent loops
      console.warn("⚠️ [useAuth] Unexpected error - returning null to prevent loop");
      return null;
    }
  };

  // CRITICAL: Don't check auth if in guest mode initially
  // This prevents infinite loops when guest mode is set
  // We'll enable it once guest mode is cleared or after a delay
  const shouldCheckAuth = !isGuestMode;
  
  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: authQueryFn,
    retry: false,
    // Only enable auth check if not in guest mode
    // This prevents infinite loops when CORS fails or network errors occur
    enabled: shouldCheckAuth,
    // Refetch on mount to catch auth changes after OAuth redirect
    refetchOnMount: shouldCheckAuth,
    // Don't refetch on window focus - can cause issues
    refetchOnWindowFocus: false,
    // Use longer staleTime to prevent constant refetching
    staleTime: 30000, // Consider stale after 30 seconds (reduces refetch frequency)
    gcTime: 60000, // Cache in memory for 1 minute
  });

  // CRITICAL: Force refetch after OAuth redirect on mobile Safari
  // Use a ref to track if we've already handled OAuth redirect (prevent infinite loops)
  const oauthRedirectHandledRef = useRef(false);
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Only run OAuth redirect logic if auth checking is enabled
  // Don't run in guest mode or if auth is disabled
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldCheckAuth) return; // Skip if auth checking is disabled (guest mode)
    
    // Check if we're on /app path (likely after OAuth redirect)
    // Use window.location directly to get fresh values
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAppPath = pathname.includes('/app');
    
    // Check URL params for OAuth callback indicator
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCallback = urlParams.get('oauth_callback') === '1';
    
    // Check sessionStorage flag
    const oauthRedirectFlag = sessionStorage.getItem('oauth_redirect');
    const hasOAuthFlag = oauthRedirectFlag !== null;
    
    const isOAuthRedirect = oauthCallback || hasOAuthFlag;
    
    // CRITICAL: Handle OAuth redirect even during initial loading
    // The condition should NOT require !isLoading because:
    // 1. On fresh page load after OAuth, isLoading might still be true
    // 2. We need to schedule the refetch regardless of loading state
    // 3. The refetch will wait for cookies to be set (1.5s delay)
    if (isAppPath && isOAuthRedirect && !oauthRedirectHandledRef.current && shouldCheckAuth) {
      // Log for debugging
      console.log("🔍 [useAuth] OAuth redirect detected, scheduling refetch:", {
        isAppPath,
        isLoading,
        oauthCallback,
        hasOAuthFlag,
        isOAuthRedirect,
        shouldCheckAuth,
        hasUser: !!user,
      });
      // Mark as handled immediately to prevent multiple executions
      oauthRedirectHandledRef.current = true;
      
      // Clear the OAuth redirect flag after checking
      if (hasOAuthFlag) {
        sessionStorage.removeItem('oauth_redirect');
      }
      
      // Clear URL params after reading
      if (oauthCallback) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
      
      // After redirect, give server time to set session cookie, then refetch ONCE
      // Use longer delay to ensure cookies are set (especially for cross-origin)
      // Increase delay for more reliable cookie propagation
      const delay = 2000; // 2 seconds for cookie propagation (increased from 1.5s)
      
      console.log(`⏳ [useAuth] Scheduling auth refetch in ${delay}ms after OAuth redirect`, {
        hasUser: !!user,
        isLoading,
        shouldCheckAuth,
      });
      
      // Clear any existing timer
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      
      refetchTimerRef.current = setTimeout(() => {
        console.log("🔄 [useAuth] Executing OAuth redirect refetch NOW", {
          shouldCheckAuth,
          hasUser: !!user,
          isLoading,
          cookies: typeof document !== 'undefined' ? document.cookie.substring(0, 100) : 'N/A',
        });
        
        // Force refetch to check if user is now authenticated after OAuth
        // Use invalidateQueries to force a fresh check, bypassing cache completely
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        refetch().then((result) => {
          const userData = result.data;
          console.log("✅ [useAuth] OAuth redirect refetch completed:", userData ? { 
            id: userData.id, 
            email: userData.email 
          } : 'null (not authenticated)');
        }).catch(err => {
          console.error("❌ [useAuth] OAuth redirect refetch failed:", err);
        });
        
        refetchTimerRef.current = null;
      }, delay);
      
      return () => {
        if (refetchTimerRef.current) {
          clearTimeout(refetchTimerRef.current);
          refetchTimerRef.current = null;
        }
      };
    }
    
    // Reset the ref if we navigate away from /app
    if (!isAppPath) {
      oauthRedirectHandledRef.current = false;
    }
  }, [isLoading, refetch, shouldCheckAuth, user]); // Run when these change to detect OAuth redirect

  // If we get a user, clear guest mode
  useEffect(() => {
    if (user && isGuestMode) {
      console.log("✅ [useAuth] User authenticated, clearing guest mode");
      // setIsGuestMode now handles localStorage removal internally
      setIsGuestMode(false);
      // Don't call refetch() here - React Query will automatically update
      // and calling refetch could cause infinite loops
    }
  }, [user, isGuestMode, setIsGuestMode]);

  // If guest mode is set, ensure auth check is disabled to prevent loops
  // This ensures that once guest mode is set, we don't keep checking auth
  useEffect(() => {
    if (isGuestMode && shouldCheckAuth) {
      console.log("⚠️ [useAuth] Guest mode active - auth checking should be disabled");
    }
  }, [isGuestMode, shouldCheckAuth]);

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
