import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Team } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

const LAST_TEAM_KEY = "lastSelectedTeamId";

export function useTeams() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  // CRITICAL: Only enable the query when user is DEFINITELY authenticated
  // Check both isAuthenticated AND user object to be extra safe
  // This prevents ANY possibility of the query running when not authenticated
  const shouldFetchTeams = Boolean(
    !authLoading && // Auth check must be complete
    isAuthenticated && // Must be authenticated
    user !== null && // User object must exist
    user !== undefined // User object must be defined
  );
  
  const { data: teams = [], isLoading, error } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: getQueryFn<Team[]>({ on401: "throw" }),
    enabled: shouldFetchTeams, // CRITICAL: Only fetch when authenticated
    retry: false, // Don't retry on errors (including 401)
    refetchOnMount: false, // Don't refetch on mount if query is disabled
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    gcTime: 0, // Don't cache the query data when disabled (prevents stale data)
  });

  // CRITICAL: Cancel/remove query if user becomes unauthenticated
  // This prevents any pending requests from continuing
  useEffect(() => {
    if (!shouldFetchTeams) {
      // User is not authenticated - cancel any pending queries immediately
      queryClient.cancelQueries({ queryKey: ["/api/teams"] });
      // Remove query from cache to prevent it from being used or refetched
      queryClient.removeQueries({ queryKey: ["/api/teams"] });
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