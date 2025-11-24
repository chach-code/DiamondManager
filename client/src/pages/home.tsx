import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users } from "lucide-react";
import PlayerCard, { type Player } from "@/components/PlayerCard";
import PlayerFormDialog from "@/components/PlayerFormDialog";
import BattingLineup from "@/components/BattingLineup";
import PositionLineup from "@/components/PositionLineup";
import ThemeToggle from "@/components/ThemeToggle";
import heroImage from "@assets/generated_images/baseball_stadium_hero_image.png";

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [battingLineup, setBattingLineup] = useState<Player[]>([]);
  const [positions, setPositions] = useState<Record<string, Player | null>>({
    P: null, C: null, "1B": null, "2B": null, "3B": null,
    SS: null, LF: null, CF: null, RF: null
  });

  const handleSavePlayer = (playerData: Omit<Player, 'id'> & { id?: string }) => {
    if (playerData.id) {
      setPlayers(prev => prev.map(p => p.id === playerData.id ? playerData as Player : p));
    } else {
      const newPlayer: Player = {
        ...playerData,
        id: Date.now().toString(),
      };
      setPlayers(prev => [...prev, newPlayer]);
    }
    setEditingPlayer(null);
  };

  const handleDeletePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
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

  return (
    <div className="min-h-screen bg-background">
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
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bebas text-3xl tracking-wide">Team Roster</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {players.length} player{players.length !== 1 ? 's' : ''} on roster
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingPlayer(null);
                  setDialogOpen(true);
                }}
                data-testid="button-add-player"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Player
              </Button>
            </div>

            {players.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-bebas text-2xl tracking-wide mb-2">No Players Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start building your roster by adding players
                </p>
                <Button
                  onClick={() => {
                    setEditingPlayer(null);
                    setDialogOpen(true);
                  }}
                  data-testid="button-add-first-player"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Player
                </Button>
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
          </TabsContent>

          <TabsContent value="batting">
            <BattingLineup
              players={players}
              lineup={battingLineup}
              onGenerate={handleGenerateBattingLineup}
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
