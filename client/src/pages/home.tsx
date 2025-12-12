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

// Demo players for guest mode and authenticated users
// Note: These are not full Player objects - just for display purposes
// Based on real MLB players
const DEMO_PLAYERS: Array<Omit<Player, 'teamId' | 'createdAt' | 'updatedAt'>> = [
  { id: 'demo-1', name: 'Salvador Pérez', number: '13', positions: ['C'] },
  { id: 'demo-2', name: 'Bobby Witt Jr.', number: '7', positions: ['SS'] },
  { id: 'demo-3', name: 'Cavan Biggio', number: '18', positions: ['1B'] },
  { id: 'demo-4', name: 'Michael Massey', number: '19', positions: ['2B'] },
  { id: 'demo-5', name: 'Jonathan India', number: '6', positions: ['3B'] },
  { id: 'demo-6', name: 'Hunter Renfroe', number: '24', positions: ['RF'] },
  { id: 'demo-7', name: 'MJ Melendez', number: '12', positions: ['LF'] },
  { id: 'demo-8', name: 'Kyle Isbel', number: '28', positions: ['CF'] },
  { id: 'demo-9', name: 'Cole Ragans', number: '55', positions: ['P'] },
  { id: 'demo-10', name: 'Carlos Estévez', number: '53', positions: ['P'] },
  { id: 'demo-11', name: 'Vinnie Pasquantino', number: '9', positions: ['1B'] },
  { id: 'demo-12', name: 'Lucas Erceg', number: '60', positions: ['P'] },
  { id: 'demo-13', name: 'John Schreiber', number: '46', positions: ['P'] },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isGuestMode, user, isAuthenticated, isLoading: authLoading } = useAuth();
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
  // Local state for guest mode players (not persisted to server)
  const [guestPlayers, setGuestPlayers] = useState<Player[]>([]);

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
    if (isGuestMode) {
      // In guest mode, update local state
      if (playerData.id) {
        // Update existing player
        setGuestPlayers(prev => prev.map(p => 
          p.id === playerData.id 
            ? { ...p, ...playerData, updatedAt: new Date() }
            : p
        ));
      } else {
        // Create new player
        const newPlayer: Player = {
          ...playerData,
          id: `guest-${Date.now()}`,
          teamId: 'guest',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Player;
        setGuestPlayers(prev => [...prev, newPlayer]);
      }
      setEditingPlayer(null);
      setDialogOpen(false);
    } else {
      // When authenticated, use API
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
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this player?")) {
      return;
    }

    if (isGuestMode) {
      // In guest mode, update local state
      setGuestPlayers(prev => prev.filter(p => p.id !== id));
      // Also remove from lineups
      setBattingLineup(prev => prev.filter(p => p.id !== id));
      setPositions(prev => {
        const newPositions = { ...prev };
        Object.keys(newPositions).forEach(key => {
          if (newPositions[key]?.id === id) {
            newPositions[key] = null;
          }
        });
        return newPositions;
      });
    } else {
      // When authenticated, use API
      try {
        await deletePlayer(id);
      } catch (error) {
        console.error("Failed to delete player:", error);
        // TODO: Show error toast
      }
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

  // Demo players work for both guest mode and authenticated users
  const handleAddDemoPlayers = async () => {
    if (isGuestMode) {
      // In guest mode, add demo players to local state
      const demoPlayersWithTimestamps: Player[] = DEMO_PLAYERS.map(demo => ({
        ...demo,
        teamId: 'guest', // Placeholder teamId for guest mode
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      setGuestPlayers(demoPlayersWithTimestamps);
    } else if (isAuthenticated && selectedTeamId) {
      // When authenticated, create demo players via API
      try {
        for (const demoPlayer of DEMO_PLAYERS) {
          await createPlayer({
            teamId: selectedTeamId,
            playerData: {
              name: demoPlayer.name,
              number: demoPlayer.number,
              positions: demoPlayer.positions,
            },
          });
        }
      } catch (error) {
        console.error("Failed to create demo players:", error);
        alert("Failed to create demo players. Please try again.");
      }
    }
  };

  const handleClearAllPlayers = async () => {
    if (isGuestMode) {
      // Clear guest mode players
      setGuestPlayers([]);
      setBattingLineup([]);
      setPositions({
        P: null, C: null, "1B": null, "2B": null, "3B": null,
        SS: null, LF: null, CF: null, RF: null
      });
    } else if (isAuthenticated && selectedTeamId && players.length > 0) {
      // When authenticated, delete all players for the team
      if (!confirm(`Are you sure you want to delete all ${players.length} players? This cannot be undone.`)) {
        return;
      }
      try {
        for (const player of players) {
          await deletePlayer(player.id);
        }
      } catch (error) {
        console.error("Failed to delete players:", error);
        alert("Failed to delete all players. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && user ? (
        <div className="bg-green-500/10 border-b border-green-500/20 px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-green-800 dark:text-green-200 truncate flex-1">
                <span className="hidden sm:inline">Welcome, {user.firstName || user.email || "User"}! Your lineups will be saved.</span>
                <span className="sm:hidden">Welcome, {user.firstName || user.email || "User"}!</span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <TeamSwitcher 
                selectedTeamId={selectedTeamId}
                onTeamSelect={handleTeamSelect}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-green-700 dark:text-green-300 hover:bg-green-500/20"
                title="Log out"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline ml-1.5">Log out</span>
              </Button>
            </div>
          </div>
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
      ) : !isAuthenticated && !authLoading ? (
        // User is not authenticated and not in guest mode - show login prompt
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Sign in to save your teams and lineups.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => window.location.href = getApiNavUrl("/api/login")}
            data-testid="button-login-unauthenticated"
          >
            Sign In with Google
          </Button>
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
                  {(() => {
                    // Use guest players in guest mode, otherwise use API players
                    const displayPlayers = isGuestMode ? guestPlayers : players;
                    const playerCount = displayPlayers.length;
                    
                    return (
                      <>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <h2 className="font-bebas text-3xl tracking-wide">Team Roster</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                              {playerCount} player{playerCount !== 1 ? 's' : ''} on roster
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {/* Show Add Demo Players button for guest mode or authenticated users with team */}
                            {(isGuestMode || (isAuthenticated && selectedTeamId)) && (
                              <Button
                                variant="outline"
                                onClick={handleAddDemoPlayers}
                                data-testid="button-add-demo"
                                disabled={isCreating}
                              >
                                {isCreating ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                  </>
                                ) : (
                                  <>
                                    <FlaskConical className="mr-2 h-4 w-4" />
                                    Add Demo Players
                                  </>
                                )}
                              </Button>
                            )}
                            {/* Show Clear All button when there are players */}
                            {playerCount > 0 && (
                              <Button
                                variant="outline"
                                onClick={handleClearAllPlayers}
                                data-testid="button-clear-all"
                                disabled={isDeleting}
                              >
                                {isDeleting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                  </>
                                )}
                              </Button>
                            )}
                            {/* Show Add Player button when authenticated with team or in guest mode */}
                            {(selectedTeamId || isGuestMode) && (
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

                        {playerCount === 0 ? (
                          <div className="text-center py-16">
                            <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="font-bebas text-2xl tracking-wide mb-2">No Players Yet</h3>
                            <p className="text-muted-foreground mb-6">
                              Start building your roster by adding players or load demo players
                            </p>
                            <div className="flex gap-3 justify-center">
                              {(isGuestMode || (isAuthenticated && selectedTeamId)) && (
                                <Button
                                  variant="outline"
                                  onClick={handleAddDemoPlayers}
                                  data-testid="button-add-demo-empty"
                                  disabled={isCreating}
                                >
                                  <FlaskConical className="mr-2 h-4 w-4" />
                                  Add Demo Players
                                </Button>
                              )}
                              {(selectedTeamId || isGuestMode) && (
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
                      {displayPlayers.map(player => (
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
                    );
                  })()}
                </>
              )}
            </TabsContent>

            <TabsContent value="batting">
              <BattingLineup
                players={isGuestMode ? guestPlayers : players}
              lineup={battingLineup}
              onGenerate={handleGenerateBattingLineup}
              positions={positions}
            />
          </TabsContent>

            <TabsContent value="positions">
              <PositionLineup
                players={isGuestMode ? guestPlayers : players}
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
