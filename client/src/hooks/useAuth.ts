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

  // Always call useQuery - just don't fetch if guest mode
  // Use returnNull behavior so 401 (not logged in) returns null instead of throwing
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    retry: false,
    enabled: !isGuestMode,
  });

  return {
    user: isGuestMode ? null : user,
    isLoading: isGuestMode ? false : isLoading,
    isAuthenticated: isGuestMode || !!user,
    isGuestMode,
  };
}
