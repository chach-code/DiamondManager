import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@shared/schema";

export function useAuth() {
  const [isGuestMode, setIsGuestMode] = useState(() => {
    // Initialize from localStorage on mount
    return localStorage.getItem("guestMode") === "true";
  });

  // Always call useQuery - just don't fetch if guest mode
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
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
