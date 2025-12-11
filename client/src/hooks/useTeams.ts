import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Team } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

const LAST_TEAM_KEY = "lastSelectedTeamId";

export function useTeams() {
  const queryClient = useQueryClient();

  // Fetch all teams for the current user
  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: getQueryFn<Team[]>({ on401: "throw" }),
    enabled: true,
  });

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