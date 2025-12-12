import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Player, InsertPlayer } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export function useTeamPlayers(teamId: string | null) {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Fetch players for a specific team
  // Only enable when we have a teamId AND user is authenticated
  // Use explicit boolean checks to ensure we never enable when not authenticated
  const shouldFetchPlayers = Boolean(teamId && isAuthenticated && !authLoading);
  
  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ["/api/teams", teamId, "players"],
    queryFn: getQueryFn<Player[]>({ on401: "throw" }),
    enabled: shouldFetchPlayers,
    retry: false, // Don't retry on errors (including 401)
    refetchOnMount: false, // Don't refetch on mount if query is disabled
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  // Create player mutation
  const createPlayerMutation = useMutation({
    mutationFn: async ({ teamId, playerData }: { teamId: string; playerData: Omit<InsertPlayer, "teamId"> }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/players`, playerData);
      return res.json() as Promise<Player>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", variables.teamId, "players"] });
    },
  });

  // Update player mutation
  const updatePlayerMutation = useMutation({
    mutationFn: async ({ playerId, playerData }: { playerId: string; playerData: Partial<InsertPlayer> }) => {
      const res = await apiRequest("PATCH", `/api/players/${playerId}`, playerData);
      return res.json() as Promise<Player>;
    },
    onSuccess: () => {
      // Invalidate players for the current team
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "players"] });
      }
    },
  });

  // Delete player mutation
  const deletePlayerMutation = useMutation({
    mutationFn: async (playerId: string) => {
      await apiRequest("DELETE", `/api/players/${playerId}`);
    },
    onSuccess: () => {
      // Invalidate players for the current team
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "players"] });
      }
    },
  });

  return {
    players,
    isLoading,
    createPlayer: createPlayerMutation.mutateAsync,
    updatePlayer: updatePlayerMutation.mutateAsync,
    deletePlayer: deletePlayerMutation.mutateAsync,
    isCreating: createPlayerMutation.isPending,
    isUpdating: updatePlayerMutation.isPending,
    isDeleting: deletePlayerMutation.isPending,
  };
}