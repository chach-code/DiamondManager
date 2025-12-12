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
  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
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
    // Check if we're on /app path (likely after OAuth redirect)
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAppPath = pathname.includes('/app');
    const oauthRedirectFlag = typeof window !== 'undefined' ? sessionStorage.getItem('oauth_redirect') : null;
    const oauthRedirect = oauthRedirectFlag !== null; // Any value means we came from OAuth
    
    if (isAppPath && !isLoading) {
      // Clear the OAuth redirect flag after checking
      if (typeof window !== 'undefined' && oauthRedirect) {
        sessionStorage.removeItem('oauth_redirect');
      }
      
      // After redirect, give server time to set session cookie, then refetch
      // This is especially important on Safari which may not send cookies immediately
      // Use longer delay on mobile Safari to account for slower cookie propagation
      const delay = oauthRedirect ? 1000 : 300; // Longer delay after OAuth redirect for mobile Safari
      const timer = setTimeout(() => {
        // Force a refetch with cache bypass
        // Using refetch() ensures we get fresh data after OAuth redirect
        // For mobile Safari, we need to be aggressive about bypassing cache
        console.log("Forcing auth refetch after OAuth redirect, delay:", delay);
        refetch();
        
        // Also try a second refetch after a longer delay for mobile Safari
        // This handles cases where cookies aren't immediately available
        if (oauthRedirect) {
          setTimeout(() => {
            console.log("Second auth refetch for mobile Safari");
            refetch();
          }, 2000);
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
