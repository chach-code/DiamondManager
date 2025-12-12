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
        cache: "no-cache", // Browser handles cache control automatically
        // Note: Removed all custom headers (Cache-Control, Pragma, Expires) to avoid CORS preflight issues
        // The server CORS config only allows 'Content-Type' and 'Authorization' headers
        // The 'cache: "no-cache"' option is sufficient for preventing caching
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

  // CRITICAL: OAuth redirect detection must ALWAYS run, even in guest mode
  // This is because a user might log in while in guest mode, and we need to detect it
  // The actual auth check will be enabled/disabled based on shouldCheckAuth, but
  // the OAuth redirect detection should run regardless
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
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
    
    // Log for debugging - always log, even if we don't handle it
    console.log("🔍 [useAuth] OAuth redirect check:", {
      isAppPath,
      isLoading,
      oauthCallback,
      hasOAuthFlag,
      isOAuthRedirect,
      alreadyHandled: oauthRedirectHandledRef.current,
      shouldCheckAuth,
      isGuestMode,
      hasUser: !!user,
    });
    
    // CRITICAL: Handle OAuth redirect even during initial loading
    // AND even if shouldCheckAuth is false (guest mode), because:
    // 1. User might log in while in guest mode - we need to detect and clear guest mode
    // 2. On fresh page load after OAuth, isLoading might still be true
    // 3. We need to schedule the refetch regardless of loading state
    // 4. The refetch will wait for cookies to be set (2s delay)
    // If shouldCheckAuth is false, we'll enable it temporarily for the OAuth check
    if (isAppPath && isOAuthRedirect && !oauthRedirectHandledRef.current) {
      // Mark as handled immediately to prevent multiple executions
      oauthRedirectHandledRef.current = true;
      
      // CRITICAL: If we're in guest mode, clear it now because user is logging in
      if (isGuestMode) {
        console.log("🔓 [useAuth] Clearing guest mode due to OAuth redirect");
        setIsGuestMode(false);
      }
      
      // Clear the OAuth redirect flag after checking
      if (hasOAuthFlag) {
        sessionStorage.removeItem('oauth_redirect');
      }
      
      // Clear URL params after reading
      if (oauthCallback) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
      
      // After redirect, give server time to set session cookie, then refetch with retries
      // Safari needs more time for cross-origin cookie propagation
      // Detect Safari and use longer delays
      const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const initialDelay = isSafari ? 3000 : 2000; // 3s for Safari, 2s for others
      const maxRetries = isSafari ? 3 : 2; // More retries for Safari
      
      console.log(`⏳ [useAuth] Scheduling auth refetch with retries after OAuth redirect`, {
        isSafari,
        initialDelay,
        maxRetries,
        hasUser: !!user,
        isLoading,
        shouldCheckAuth: !isGuestMode,
        wasInGuestMode: isGuestMode,
      });
      
      // Clear any existing timer
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      
      // Retry function that attempts to refetch auth status
      const attemptRefetch = (attemptNumber: number, delay: number) => {
        console.log(`⏰ [useAuth] Scheduling retry attempt ${attemptNumber}/${maxRetries} in ${delay}ms`);
        const timerId = setTimeout(() => {
          console.log(`⏰ [useAuth] Retry attempt ${attemptNumber}/${maxRetries} EXECUTING NOW`);
          
          // Check current guest mode state
          const currentGuestMode = localStorage.getItem("guestMode") === "true";
          const currentShouldCheckAuth = !currentGuestMode;
          
          // Log cookies for debugging - try multiple methods to check cookies
          const cookieInfo = typeof document !== 'undefined' ? {
            cookieCount: document.cookie.split(';').filter(c => c.trim()).length,
            hasCookies: document.cookie.length > 0,
            cookiePreview: document.cookie.substring(0, 200),
            allCookies: document.cookie, // Log full cookie string for debugging
            cookiesArray: document.cookie.split(';').map(c => c.trim()),
          } : { cookieCount: 0, hasCookies: false, cookiePreview: 'N/A', allCookies: 'N/A', cookiesArray: [] };
          
          console.log(`🔄 [useAuth] OAuth redirect refetch attempt ${attemptNumber}/${maxRetries}`, {
            shouldCheckAuth: currentShouldCheckAuth,
            isGuestMode: currentGuestMode,
            hasUser: !!user,
            isLoading,
            timerRefExists: !!refetchTimerRef.current,
            ...cookieInfo,
          });
          
          // Always invalidate queries to clear cache
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          
          if (currentShouldCheckAuth) {
            refetch().then((result) => {
              const userData = result.data;
              if (userData) {
                // Success! User is authenticated
                console.log("✅ [useAuth] OAuth redirect refetch succeeded on attempt", attemptNumber, ":", {
                  id: userData.id,
                  email: userData.email
                });
                refetchTimerRef.current = null;
              } else if (attemptNumber < maxRetries) {
                // Still not authenticated, retry with exponential backoff
                const nextDelay = delay * 1.5; // Exponential backoff
                console.log(`⚠️ [useAuth] Auth check returned null on attempt ${attemptNumber}, retrying in ${nextDelay}ms...`);
                attemptRefetch(attemptNumber + 1, nextDelay);
              } else {
                // Max retries reached
                console.warn("❌ [useAuth] OAuth redirect refetch failed after", maxRetries, "attempts - user may not be authenticated");
                refetchTimerRef.current = null;
              }
            }).catch(err => {
              if (attemptNumber < maxRetries) {
                // Error occurred, retry with exponential backoff
                const nextDelay = delay * 1.5;
                console.warn(`⚠️ [useAuth] Refetch error on attempt ${attemptNumber}, retrying in ${nextDelay}ms:`, err);
                attemptRefetch(attemptNumber + 1, nextDelay);
              } else {
                console.error("❌ [useAuth] OAuth redirect refetch failed after", maxRetries, "attempts:", err);
                refetchTimerRef.current = null;
              }
            });
          } else {
            // Still in guest mode - query will auto-refetch when guest mode is cleared
            console.log("⏸️ [useAuth] Still in guest mode, query will auto-refetch when guest mode clears");
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            refetchTimerRef.current = null;
          }
        }, delay);
        
        refetchTimerRef.current = timerId as unknown as NodeJS.Timeout;
      };
      
      // Start the retry sequence
      console.log(`🚀 [useAuth] Starting retry sequence with ${maxRetries} retries, initial delay: ${initialDelay}ms`);
      attemptRefetch(1, initialDelay);
      
      // IMPORTANT: Don't clear the timeout in cleanup if we're still on the app path
      // This ensures retries can complete even if component re-renders
      return () => {
        // Only clear if we navigate away from /app
        const currentPathname = typeof window !== 'undefined' ? window.location.pathname : '';
        if (!currentPathname.includes('/app')) {
          console.log("🧹 [useAuth] Cleaning up retry timer (navigated away from /app)");
          if (refetchTimerRef.current) {
            clearTimeout(refetchTimerRef.current);
            refetchTimerRef.current = null;
          }
        } else {
          console.log("⏸️ [useAuth] Skipping cleanup (still on /app, retries may be in progress)");
        }
      };
    }
    
    // Reset the ref if we navigate away from /app
    if (!isAppPath) {
      oauthRedirectHandledRef.current = false;
    }
  }, [isLoading, refetch, shouldCheckAuth, isGuestMode, user, setIsGuestMode]); // Run when these change to detect OAuth redirect

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
