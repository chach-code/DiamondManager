import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
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
    // Use a small staleTime to allow caching but still detect auth changes
    // Setting to 0 causes infinite loops, so use 5 seconds as a balance
    staleTime: 5000, // Consider stale after 5 seconds (allows some caching)
    gcTime: 60000, // Cache in memory for 1 minute
  });

  // CRITICAL: Force refetch after OAuth redirect on mobile Safari
  // Use a ref to track if we've already handled OAuth redirect (prevent infinite loops)
  const oauthRedirectHandledRef = useRef(false);
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    
    const isOAuthRedirect = oauthCallback || hasOAuthFlag;
    
    // Log for debugging
    console.log("🔍 OAuth redirect detection:", {
      pathname,
      isAppPath,
      oauthCallback,
      hasOAuthFlag,
      isLoading,
      alreadyHandled: oauthRedirectHandledRef.current,
      hasCookies: document.cookie.length > 0,
      cookieCount: document.cookie.split(';').length,
    });
    
    // Only handle OAuth redirect once, and only when not loading
    if (isAppPath && !isLoading && isOAuthRedirect && !oauthRedirectHandledRef.current) {
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
      // Mobile Safari may need a delay for cookie propagation
      const delay = 1500; // Delay for mobile Safari cookie propagation
      
      console.log(`⏳ Scheduling SINGLE auth refetch in ${delay}ms after OAuth redirect`);
      
      // Clear any existing timer
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      
      refetchTimerRef.current = setTimeout(() => {
        console.log("🔄 Forcing auth refetch after OAuth redirect (single attempt)");
        refetch().catch(err => {
          console.error("❌ Refetch failed:", err);
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
  }, [isLoading, refetch]); // Only run when loading state changes

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
