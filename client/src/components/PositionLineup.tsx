import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";
import type { Player } from "./PlayerCard";

interface PositionLineupProps {
  players: Player[];
  positions: Record<string, Player | null>;
  onGenerate: () => void;
}

const POSITION_LABELS: Record<string, string> = {
  P: "Pitcher",
  C: "Catcher",
  "1B": "First Base",
  "2B": "Second Base",
  "3B": "Third Base",
  SS: "Shortstop",
  LF: "Left Field",
  CF: "Center Field",
  RF: "Right Field",
};

export default function PositionLineup({ players, positions, onGenerate }: PositionLineupProps) {
  const hasEnoughPlayers = players.length >= 9;
  const hasPositions = Object.values(positions).some(p => p !== null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bebas text-3xl tracking-wide">Field Positions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a random defensive lineup
          </p>
        </div>
        <Button
          onClick={onGenerate}
          disabled={!hasEnoughPlayers}
          data-testid="button-generate-positions"
        >
          <Shuffle className="mr-2 h-4 w-4" />
          Generate Positions
        </Button>
      </div>

      {!hasEnoughPlayers && (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-center text-muted-foreground">
            Need at least 9 players to generate positions. 
            Currently have {players.length} player{players.length !== 1 ? 's' : ''}.
          </p>
        </Card>
      )}

      {hasPositions && (
        <div className="relative w-full aspect-square max-w-2xl mx-auto">
          <div className="absolute inset-0 bg-primary/5 rounded-md" />
          
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2">
            <PositionCard position="P" player={positions.P} />
          </div>
          
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2">
            <PositionCard position="C" player={positions.C} />
          </div>
          
          <div className="absolute bottom-[15%] left-[15%]">
            <PositionCard position="1B" player={positions["1B"]} />
          </div>
          
          <div className="absolute bottom-[35%] left-[35%]">
            <PositionCard position="2B" player={positions["2B"]} />
          </div>
          
          <div className="absolute bottom-[15%] right-[15%]">
            <PositionCard position="3B" player={positions["3B"]} />
          </div>
          
          <div className="absolute bottom-[35%] right-[35%]">
            <PositionCard position="SS" player={positions.SS} />
          </div>
          
          <div className="absolute top-[15%] left-[5%]">
            <PositionCard position="LF" player={positions.LF} />
          </div>
          
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2 translate-y-[-120%]">
            <PositionCard position="CF" player={positions.CF} />
          </div>
          
          <div className="absolute top-[15%] right-[5%]">
            <PositionCard position="RF" player={positions.RF} />
          </div>
        </div>
      )}

      {!hasPositions && hasEnoughPlayers && (
        <Card className="p-12 border-dashed">
          <div className="text-center text-muted-foreground">
            <Shuffle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Generate Positions" to assign players to field positions</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function PositionCard({ position, player }: { position: string; player: Player | null }) {
  return (
    <Card className="p-3 min-w-[120px] hover-elevate" data-testid={`card-position-${position}`}>
      <div className="text-center">
        <div className="text-xs font-semibold text-muted-foreground mb-1">
          {position}
        </div>
        {player ? (
          <>
            <div className="w-10 h-10 mx-auto rounded-full bg-primary flex items-center justify-center mb-1">
              <span className="text-lg font-bold text-primary-foreground">
                {player.number}
              </span>
            </div>
            <div className="text-sm font-medium truncate" data-testid={`text-position-name-${position}`}>
              {player.name}
            </div>
          </>
        ) : (
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-dashed border-muted mb-1" />
        )}
      </div>
    </Card>
  );
}
