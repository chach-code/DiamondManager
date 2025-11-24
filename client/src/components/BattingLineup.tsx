import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";
import type { Player } from "./PlayerCard";

interface BattingLineupProps {
  players: Player[];
  lineup: Player[];
  onGenerate: () => void;
}

export default function BattingLineup({ players, lineup, onGenerate }: BattingLineupProps) {
  const hasEnoughPlayers = players.length >= 9;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bebas text-3xl tracking-wide">Batting Order</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a random 9-player batting lineup
          </p>
        </div>
        <Button
          onClick={onGenerate}
          disabled={!hasEnoughPlayers}
          data-testid="button-generate-batting"
        >
          <Shuffle className="mr-2 h-4 w-4" />
          Generate Lineup
        </Button>
      </div>

      {!hasEnoughPlayers && (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-center text-muted-foreground">
            Need at least 9 players to generate a batting lineup. 
            Currently have {players.length} player{players.length !== 1 ? 's' : ''}.
          </p>
        </Card>
      )}

      {lineup.length > 0 && (
        <div className="space-y-3">
          {lineup.map((player, index) => (
            <Card key={player.id} className="p-4 hover-elevate" data-testid={`card-batting-${index + 1}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold" data-testid={`text-batting-name-${index + 1}`}>
                      {player.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {player.positions.join(', ')}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    #{player.number}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {lineup.length === 0 && hasEnoughPlayers && (
        <Card className="p-12 border-dashed">
          <div className="text-center text-muted-foreground">
            <Shuffle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Generate Lineup" to create a random batting order</p>
          </div>
        </Card>
      )}
    </div>
  );
}
