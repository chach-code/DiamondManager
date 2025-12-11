import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { addBasePath, getBasePath } from "@/lib/basePath";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, Trash2, FlaskConical, LogOut, AlertCircle, Loader2 } from "lucide-react";
import PlayerCard from "@/components/PlayerCard";
import type { Player } from "@shared/schema";
import PlayerFormDialog from "@/components/PlayerFormDialog";
import BattingLineup from "@/components/BattingLineup";
import PositionLineup from "@/components/PositionLineup";
import ThemeToggle from "@/components/ThemeToggle";
import TeamSwitcher from "@/components/TeamSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";
import { useTeamPlayers } from "@/hooks/useTeamPlayers";
import { getApiNavUrl } from "@/lib/apiConfig";
import heroImage from "@assets/generated_images/baseball_stadium_hero_image.png";

// Demo players for guest mode (not used when authenticated)
// Note: These are not full Player objects - just for display purposes
const DEMO_PLAYERS: Array<Omit<Player, 'teamId' | 'createdAt' | 'updatedAt'>> = [
  { id: 'demo-1', name: 'Mike Rodriguez', number: '24', positions: ['SS', '2B'] },
  { id: 'demo-2', name: 'Jake Thompson', number: '7', positions: ['P'] },
  { id: 'demo-3', name: 'Chris Martinez', number: '15', positions: ['C'] },
  { id: 'demo-4', name: 'Ryan Davis', number: '32', positions: ['1B', '3B'] },
  { id: 'demo-5', name: 'Tyler Johnson', number: '11', positions: ['LF', 'CF', 'RF'] },
  { id: 'demo-6', name: 'Alex Smith', number: '9', positions: ['2B', 'SS'] },
  { id: 'demo-7', name: 'Jordan Lee', number: '18', positions: ['LF', 'CF'] },
  { id: 'demo-8', name: 'Kevin Brown', number: '5', positions: ['3B', 'SS'] },
  { id: 'demo-9', name: 'Sam Wilson', number: '21', positions: ['RF', 'CF'] },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isGuestMode, user, isAuthenticated } = useAuth();
  const { teams, isLoading: teamsLoading, getDefaultTeamId, setLastSelectedTeamId } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const { 
    players, 
    isLoading: playersLoading, 
    createPlayer, 
    updatePlayer, 
    deletePlayer,
    isCreating,
    isUpdating,
    isDeleting,
  } = useTeamPlayers(selectedTeamId);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [battingLineup, setBattingLineup] = useState<Player[]>([]);
  const [positions, setPositions] = useState<Record<string, Player | null>>({
    P: null, C: null, "1B": null, "2B": null, "3B": null,
    SS: null, LF: null, CF: null, RF: null
  });

  // Initialize team selection on mount or when teams load
  useEffect(() => {
    if (!teamsLoading && teams.length > 0 && !selectedTeamId) {
      const defaultTeamId = getDefaultTeamId();
      if (defaultTeamId) {
        setSelectedTeamId(defaultTeamId);
        setLastSelectedTeamId(defaultTeamId);
      }
    }
  }, [teamsLoading, teams, selectedTeamId, getDefaultTeamId, setLastSelectedTeamId]);

  // Handle team selection change
  const handleTeamSelect = (teamId: string) => {
    setSelectedTeamId(teamId);
    setLastSelectedTeamId(teamId);
    // Clear lineups when switching teams
    setBattingLineup([]);
    setPositions({
      P: null, C: null, "1B": null, "2B": null, "3B": null,
      SS: null, LF: null, CF: null, RF: null
    });
  };

  const handleLogout = () => {
    if (isGuestMode) {
      localStorage.removeItem("guestMode");
      const base = getBasePath();
      setLocation(base ? `${base}/` : "/");
    } else {
      window.location.href = getApiNavUrl("/api/logout");
    }
  };

  const handleSavePlayer = async (playerData: Omit<Player, 'id' | 'teamId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (!selectedTeamId) {
      console.error("No team selected");
      throw new Error("No team selected");
    }

    if (playerData.id) {
      // Update existing player
      await updatePlayer({
        playerId: playerData.id,
        playerData: {
          name: playerData.name,
          number: playerData.number, // Already a string from schema
          positions: playerData.positions,
        },
      });
    } else {
      // Create new player
      await createPlayer({
        teamId: selectedTeamId,
        playerData: {
          name: playerData.name,
          number: playerData.number, // Already a string from schema
          positions: playerData.positions,
        },
      });
    }
      // Dialog will close from PlayerFormDialog after successful save
      setEditingPlayer(null);
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this player?")) {
      return;
    }

    try {
      await deletePlayer(id);
    } catch (error) {
      console.error("Failed to delete player:", error);
      // TODO: Show error toast
    }
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setDialogOpen(true);
  };

  const handleGenerateBattingLineup = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setBattingLineup(shuffled.slice(0, 9));
  };

  const handleGeneratePositions = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const positionKeys = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
    const newPositions: Record<string, Player | null> = {};
    
    positionKeys.forEach((pos, index) => {
      newPositions[pos] = shuffled[index] || null;
    });
    
    setPositions(newPositions);
  };

  // Demo players only work in guest mode
  const handleAddDemoPlayers = () => {
    if (isGuestMode) {
      // In guest mode, we can still use local state
      // This is a fallback for non-authenticated users
      // Note: We'd need to maintain a separate local state for guest mode
      // For now, this is a placeholder - guest mode players won't persist
      alert("Demo players are only available when logged in. Please sign in to use teams.");
    }
  };

  const handleClearAllPlayers = () => {
    if (isGuestMode) {
      // Only works in guest mode - for authenticated users, players are managed per team
      // This would need separate local state management for guest mode
      alert("Please sign in to manage teams and players.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && user ? (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-3 flex items-center gap-3">
          <Users className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            Welcome, {user.firstName || user.email || "User"}! Your lineups will be saved.
          </p>
        </div>
      ) : isGuestMode ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You're in guest mode. Your lineups won't be saved. 
            <button 
              onClick={() => window.location.href = getApiNavUrl("/api/login")}
              data-testid="button-sign-in-banner"
              className="ml-2 underline hover:opacity-80 font-medium"
            >
              Sign in to save your progress.
            </button>
          </p>
        </div>
      ) : null}
      <div className="relative h-[400px] overflow-hidden">
        <img
          src={heroImage}
          alt="Baseball Stadium"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-background" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="font-bebas text-6xl md:text-7xl tracking-wide text-white mb-4">
            Team Roster Management
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl">
            Build your roster and generate batting orders and field positions with ease
          </p>
        </div>
        <div className="absolute top-4 right-4 flex gap-2 items-center">
          {isAuthenticated && !teamsLoading && (
            <TeamSwitcher 
              selectedTeamId={selectedTeamId}
              onTeamSelect={handleTeamSelect}
            />
          )}
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isGuestMode ? "Exit Guest" : "Logout"}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isAuthenticated && !selectedTeamId && !teamsLoading && teams.length === 0 && (
          <div className="text-center py-16">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bebas text-2xl tracking-wide mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first team to start managing players and lineups
            </p>
            <TeamSwitcher 
              selectedTeamId={null}
              onTeamSelect={handleTeamSelect}
            />
          </div>
        )}
        
        {(!isAuthenticated || selectedTeamId) && (
          <Tabs defaultValue="roster" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto" data-testid="tabs-navigation">
              <TabsTrigger value="roster" data-testid="tab-roster">
                <Users className="h-4 w-4 mr-2" />
                Roster
              </TabsTrigger>
              <TabsTrigger value="batting" data-testid="tab-batting">Batting</TabsTrigger>
              <TabsTrigger value="positions" data-testid="tab-positions">Positions</TabsTrigger>
            </TabsList>

            <TabsContent value="roster" className="space-y-6">
              {isAuthenticated && playersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-bebas text-3xl tracking-wide">Team Roster</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {players.length} player{players.length !== 1 ? 's' : ''} on roster
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isAuthenticated && (
                        <>
                          <Button
                            variant="outline"
                            onClick={handleAddDemoPlayers}
                            data-testid="button-add-demo"
                          >
                            <FlaskConical className="mr-2 h-4 w-4" />
                            Add Demo Players
                          </Button>
                          {players.length > 0 && (
                            <Button
                              variant="outline"
                              onClick={handleClearAllPlayers}
                              data-testid="button-clear-all"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Clear All
                            </Button>
                          )}
                        </>
                      )}
                      {selectedTeamId && (
                        <Button
                          onClick={() => {
                            setEditingPlayer(null);
                            setDialogOpen(true);
                          }}
                          data-testid="button-add-player"
                          disabled={isCreating || isUpdating}
                        >
                          {isCreating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Player
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {players.length === 0 ? (
                    <div className="text-center py-16">
                      <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-bebas text-2xl tracking-wide mb-2">No Players Yet</h3>
                      <p className="text-muted-foreground mb-6">
                        {isAuthenticated 
                          ? "Start building your roster by adding players" 
                          : "Start building your roster by adding players or load demo players"}
                      </p>
                      <div className="flex gap-3 justify-center">
                        {!isAuthenticated && (
                          <Button
                            variant="outline"
                            onClick={handleAddDemoPlayers}
                            data-testid="button-add-demo-empty"
                          >
                            <FlaskConical className="mr-2 h-4 w-4" />
                            Add Demo Players
                          </Button>
                        )}
                        {selectedTeamId && (
                          <Button
                            onClick={() => {
                              setEditingPlayer(null);
                              setDialogOpen(true);
                            }}
                            data-testid="button-add-first-player"
                            disabled={isCreating}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Player
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {players.map(player => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          onEdit={handleEditPlayer}
                          onDelete={handleDeletePlayer}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

          <TabsContent value="batting">
            <BattingLineup
              players={players}
              lineup={battingLineup}
              onGenerate={handleGenerateBattingLineup}
              positions={positions}
            />
          </TabsContent>

          <TabsContent value="positions">
            <PositionLineup
              players={players}
              positions={positions}
              onGenerate={handleGeneratePositions}
            />
          </TabsContent>
        </Tabs>
        )}
      </div>

      <PlayerFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPlayer(null);
        }}
        player={editingPlayer}
        onSave={handleSavePlayer}
      />
    </div>
  );
}
