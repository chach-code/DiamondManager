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
  
  // CRITICAL: Safari fix - track OAuth redirect and add delay before enabling teams query
  // Safari needs time for localStorage token to be fully accessible after OAuth redirect
  const [safariDelayComplete, setSafariDelayComplete] = useState(false);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const oauthRedirectDetectedRef = useRef(false);

  // Detect OAuth redirect in Safari
  useEffect(() => {
    if (typeof window === 'undefined') {
      setSafariDelayComplete(true); // Enable immediately if no window
      return;
    }
    
    const pathname = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCallback = urlParams.get('oauth_callback') === '1';
    const oauthRedirectFlag = sessionStorage.getItem('oauth_redirect');
    const isAppPath = pathname.includes('/app');
    const isOAuthRedirect = (oauthCallback || oauthRedirectFlag) && isAppPath;
    
    // Detect Safari
    const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isOAuthRedirect && isSafari && !oauthRedirectDetectedRef.current) {
      oauthRedirectDetectedRef.current = true;
      console.log("🍎 [useTeams] Safari OAuth redirect detected, adding delay before enabling teams query");
      
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
          console.log("✅ [useTeams] Token verified accessible, enabling teams query");
          setSafariDelayComplete(true);
        } else {
          console.warn("⚠️ [useTeams] Token not found after delay, but enabling query anyway");
          setSafariDelayComplete(true);
        }
      }, 500); // 500ms delay for Safari
    } else {
      // Not Safari OAuth redirect - enable immediately
      if (!safariDelayComplete) {
        setSafariDelayComplete(true);
      }
    }
    
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, []); // Run once on mount

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
    });
  }, [shouldFetchTeams, authLoading, isAuthenticated, user]);
  
  const { data: teams = [], isLoading, error, fetchStatus } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async (context) => {
      console.log("🚀 [useTeams] Query function executing", {
        queryKey: context.queryKey,
        shouldFetchTeams,
      });
      
      // CRITICAL: Safari fix - verify token is accessible before making request
      // Safari sometimes has timing issues where localStorage reads fail immediately after write
      const token = getAuthToken();
      if (!token) {
        console.warn("⚠️ [useTeams] Token not found in localStorage, waiting 100ms and retrying");
        // Wait a bit and try again (Safari timing issue)
        await new Promise(resolve => setTimeout(resolve, 100));
        const retryToken = getAuthToken();
        if (!retryToken) {
          throw new Error("401: Unauthorized - authentication token not available");
        }
        console.log("✅ [useTeams] Token found after retry");
      }
      
      const result = await getQueryFn<Team[]>({ on401: "throw" })(context);
      console.log("✅ [useTeams] Query function completed", {
        resultLength: Array.isArray(result) ? result.length : 'not array',
        result,
      });
      return result;
    },
    enabled: shouldFetchTeams, // CRITICAL: Only fetch when authenticated
    retry: false, // Don't retry on errors (including 401)
    retryOnMount: false, // Don't retry on mount even if there's an error
    refetchOnMount: false, // Don't refetch on mount if query is disabled
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    gcTime: 0, // Don't cache the query data when disabled (prevents stale data)
    staleTime: Infinity, // Never consider data stale (prevents automatic refetches)
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
  
  // Log query state changes
  useEffect(() => {
    if (error) {
      console.error("❌ [useTeams] Query error:", error);
    }
    if (teams.length > 0) {
      console.log("✅ [useTeams] Teams loaded:", teams.length);
    }
  }, [error, teams]);

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