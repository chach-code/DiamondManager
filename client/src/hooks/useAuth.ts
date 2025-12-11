import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const [isGuestMode, setIsGuestMode] = useState(() => {
    // Initialize from localStorage on mount
    // Safari might throw an error if localStorage is not available (private mode, etc.)
    try {
      return localStorage.getItem("guestMode") === "true";
    } catch (e) {
      console.warn("localStorage not available, defaulting to guest mode:", e);
      return true;
    }
  });

  // ALWAYS check for authentication, even in guest mode
  // This ensures we detect when user logs in via OAuth
  // Use returnNull behavior so 401 (not logged in) returns null instead of throwing
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    retry: false,
    // Always enabled - we need to check auth status even if guest mode is set
    enabled: true,
    // Refetch on mount to catch auth changes after OAuth redirect
    refetchOnMount: true,
    // Don't refetch on window focus - can cause issues
    refetchOnWindowFocus: false,
  });

  // If we get a user, clear guest mode
  useEffect(() => {
    if (user && isGuestMode) {
      try {
        localStorage.removeItem("guestMode");
        setIsGuestMode(false);
        // Don't call refetch() here - React Query will automatically update
        // and calling refetch could cause infinite loops
      } catch (e) {
        console.warn("Failed to update localStorage:", e);
      }
    }
  }, [user, isGuestMode]); // Removed refetch from dependencies to prevent infinite loop

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
