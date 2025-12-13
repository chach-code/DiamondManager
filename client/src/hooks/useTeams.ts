import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import type { Team } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/authToken";

const LAST_TEAM_KEY = "lastSelectedTeamId";

export function useTeams() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  
  // CRITICAL: Safari fix - add delay before enabling teams query when user becomes authenticated
  // Safari needs time for localStorage token to be fully accessible after authentication
  const [safariDelayComplete, setSafariDelayComplete] = useState(false);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const delayTriggeredRef = useRef(false);

  // CRITICAL: In Safari, always add a delay when user becomes authenticated
  // This ensures localStorage token is fully accessible before making API requests
  useEffect(() => {
    if (typeof window === 'undefined') {
      setSafariDelayComplete(true); // Enable immediately if no window
      return;
    }
    
    // Detect Safari
    const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // CRITICAL: In Safari, add delay when user becomes authenticated
    // This handles Safari's localStorage timing issues
    if (isSafari && isAuthenticated && !authLoading && user && !delayTriggeredRef.current) {
      delayTriggeredRef.current = true;
      console.log("🍎 [useTeams] Safari detected with authenticated user, adding delay before enabling teams query", {
        userId: user.id,
        email: user.email,
        isAuthenticated,
        authLoading,
      });
      
      // Clear any existing timer
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
      
      // Add delay to ensure token is accessible in Safari
      // Safari sometimes needs a moment for localStorage writes to be fully committed
      delayTimerRef.current = setTimeout(() => {
        // Verify token is accessible before enabling query
        const token = getAuthToken();
        if (token) {
          console.log("✅ [useTeams] Token verified accessible, enabling teams query", {
            tokenLength: token.length,
            tokenPreview: token.substring(0, 30) + '...',
            tokenParts: token.split('.').length, // Should be 3 for JWT
          });
          setSafariDelayComplete(true);
        } else {
          console.error("❌ [useTeams] Token not found after delay - this should not happen!", {
            localStorageAvailable: typeof localStorage !== 'undefined',
            shouldUseTokenAuth: typeof window !== 'undefined' ? (() => {
              try {
                const { shouldUseTokenAuth } = require('@/lib/authToken');
                return shouldUseTokenAuth();
              } catch {
                return 'error checking';
              }
            })() : 'N/A',
          });
          // Still enable to avoid blocking forever, but log error
          setSafariDelayComplete(true);
        }
      }, 500); // Reduced to 500ms - if token isn't accessible by then, something else is wrong
    } else if (!isSafari) {
      // Not Safari - enable immediately
      if (!safariDelayComplete) {
        setSafariDelayComplete(true);
      }
    } else if (isSafari && (!isAuthenticated || authLoading || !user)) {
      // Safari but not authenticated yet - reset delay trigger so it can run when auth completes
      delayTriggeredRef.current = false;
      setSafariDelayComplete(false);
    }
    
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, [isAuthenticated, authLoading, user]); // Re-run when auth state changes

  // CRITICAL: Only enable the query when user is DEFINITELY authenticated
  // AND Safari delay is complete (if applicable)
  // Check both isAuthenticated AND user object to be extra safe
  // This prevents ANY possibility of the query running when not authenticated
  const shouldFetchTeams = Boolean(
    !authLoading && // Auth check must be complete
    isAuthenticated && // Must be authenticated
    user !== null && // User object must exist
    user !== undefined && // User object must be defined
    safariDelayComplete // Safari delay must be complete (if OAuth redirect)
  );
  
  // Log when shouldFetchTeams changes
  useEffect(() => {
    console.log("🔍 [useTeams] shouldFetchTeams changed", {
      shouldFetchTeams,
      authLoading,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      safariDelayComplete,
      isSafari: typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    });
  }, [shouldFetchTeams, authLoading, isAuthenticated, user, safariDelayComplete]);
  
  const { data: teams = [], isLoading, error, fetchStatus } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: shouldFetchTeams, // CRITICAL: Only fetch when authenticated AND delay complete
    retry: false, // NO RETRIES - if it fails, it fails. No loops.
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    staleTime: Infinity,
    queryFn: async (context) => {
      const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      console.log("🚀 [useTeams] Query function executing", {
        queryKey: context.queryKey,
        shouldFetchTeams,
        isSafari,
        safariDelayComplete,
        isAuthenticated,
        hasUser: !!user,
      });
      
      // CRITICAL: Safari fix - verify token is accessible before making request
      // Log token details for debugging
      const token = getAuthToken();
      
      if (!token) {
        console.error("❌ [useTeams] Token not found in localStorage - cannot make request", {
          isSafari,
          localStorageAvailable: typeof localStorage !== 'undefined',
          shouldUseTokenAuth: typeof window !== 'undefined' ? (() => {
            try {
              const { shouldUseTokenAuth } = require('@/lib/authToken');
              return shouldUseTokenAuth();
            } catch {
              return 'error checking';
            }
          })() : 'N/A',
        });
        throw new Error("401: Unauthorized - authentication token not available");
      }
      
      console.log("✅ [useTeams] Token verified accessible before request", {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 30) + '...',
        tokenParts: token.split('.').length, // Should be 3 for JWT
        isSafari,
        willBeIncludedInHeader: true,
      });
      
      const result = await getQueryFn<Team[]>({ on401: "throw" })(context);
      console.log("✅ [useTeams] Query function completed", {
        resultLength: Array.isArray(result) ? result.length : 'not array',
        result,
      });
      return result;
    },
  });
  
  // Log query status changes
  useEffect(() => {
    console.log("🔍 [useTeams] Query status changed", {
      enabled: shouldFetchTeams,
      isLoading,
      fetchStatus,
      hasError: !!error,
      teamsCount: teams.length,
    });
  }, [shouldFetchTeams, isLoading, fetchStatus, error, teams.length]);
  
  // Log query state changes - only log once per error to avoid spam
  const lastErrorRef = useRef<Error | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error as Error;
      console.error("❌ [useTeams] Query error:", {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        shouldFetchTeams,
        isAuthenticated,
        hasUser: !!user,
        safariDelayComplete,
      });
    }
    if (teams.length > 0) {
      console.log("✅ [useTeams] Teams loaded:", teams.length);
    }
  }, [error, teams, shouldFetchTeams, isAuthenticated, user, safariDelayComplete]);

  // CRITICAL: Cancel queries if user becomes unauthenticated
  // Only cancel - don't remove/reset as that might trigger React Query to re-initialize
  useEffect(() => {
    if (!shouldFetchTeams) {
      // User is not authenticated - cancel any pending queries immediately
      // Use cancelQueries which stops in-flight requests without removing cache
      queryClient.cancelQueries({ queryKey: ["/api/teams"], exact: true });
    }
  }, [shouldFetchTeams, queryClient]);

  // Get last selected team ID from localStorage
  const getLastSelectedTeamId = (): string | null => {
    try {
      return localStorage.getItem(LAST_TEAM_KEY);
    } catch {
      return null;
    }
  };

  // Save last selected team ID to localStorage
  const setLastSelectedTeamId = (teamId: string | null) => {
    try {
      if (teamId) {
        localStorage.setItem(LAST_TEAM_KEY, teamId);
      } else {
        localStorage.removeItem(LAST_TEAM_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  };

  // Get the default team to select
  // Priority: last selected > first team > null
  const getDefaultTeamId = (): string | null => {
    if (teams.length === 0) return null;
    
    const lastSelected = getLastSelectedTeamId();
    if (lastSelected && teams.some(t => t.id === lastSelected)) {
      return lastSelected;
    }
    
    // If only one team, use it
    if (teams.length === 1) {
      return teams[0].id;
    }
    
    // Otherwise use first team
    return teams[0].id;
  };

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/teams", { name });
      return res.json() as Promise<Team>;
    },
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      // Auto-select the newly created team
      setLastSelectedTeamId(newTeam.id);
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: (_, deletedTeamId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      // If we deleted the currently selected team, clear it
      const lastSelected = getLastSelectedTeamId();
      if (lastSelected === deletedTeamId) {
        setLastSelectedTeamId(null);
      }
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/teams/${id}`, { name });
      return res.json() as Promise<Team>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
  });

  return {
    teams,
    isLoading,
    getLastSelectedTeamId,
    setLastSelectedTeamId,
    getDefaultTeamId,
    createTeam: createTeamMutation.mutateAsync,
    deleteTeam: deleteTeamMutation.mutateAsync,
    updateTeam: updateTeamMutation.mutateAsync,
    isCreating: createTeamMutation.isPending,
    isDeleting: deleteTeamMutation.isPending,
    isUpdating: updateTeamMutation.isPending,
  };
}