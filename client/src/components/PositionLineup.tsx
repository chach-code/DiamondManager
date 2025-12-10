import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";
import type { Player } from "./PlayerCard";
import baseballFieldImage from "@assets/image_1764009560393.png";

interface PositionLineupProps {
  players: Player[];
  positions: Record<string, Player | null>;
  onGenerate: () => void;
}

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
        <div className="relative w-full max-w-3xl mx-auto" style={{ paddingBottom: '100%' }}>
          <div className="absolute inset-0">
              <img 
                src={baseballFieldImage} 
                alt="Baseball field" 
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              />

            {/* Home/umpire area */}
            <div className="absolute top-[78%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="C" player={positions.C} />
            </div>

            {/* Pitcher */}
            <div className="absolute top-[62%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="P" player={positions.P} />
            </div>

            {/* Corners */}
            <div className="absolute top-[56%] right-[22%] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="1B" player={positions["1B"]} />
            </div>

            <div className="absolute top-[56%] left-[22%] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="3B" player={positions["3B"]} />
            </div>

            {/* Middle infield */}
            <div className="absolute top-[36%] right-[36%] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="2B" player={positions["2B"]} />
            </div>

            <div className="absolute top-[36%] left-[36%] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="SS" player={positions.SS} />
            </div>

            {/* Outfield */}
            <div className="absolute top-[22%] left-[14%] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="LF" player={positions.LF} />
            </div>

            <div className="absolute top-[12%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="CF" player={positions.CF} />
            </div>

            <div className="absolute top-[22%] right-[14%] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <PositionMarker position="RF" player={positions.RF} />
            </div>
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

function PositionMarker({ position, player }: { position: string; player: Player | null }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center" data-testid={`card-position-${position}`}>
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-1 bg-white/60">
          <span className="text-xs font-semibold text-muted-foreground">{position}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" data-testid={`card-position-${position}`}>
      <div className="w-12 h-12 rounded-full bg-primary border-2 border-primary-border flex items-center justify-center mb-1 shadow-md">
        <span className="text-xl font-bold text-primary-foreground">
          {player.number}
        </span>
      </div>
      <div className="text-center bg-card px-2 py-1 rounded-md shadow-sm border border-card-border max-w-[120px]">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {position}
        </div>
        <div className="text-xs font-semibold truncate" data-testid={`text-position-name-${position}`}>
          {player.name}
        </div>
      </div>
    </div>
  );
}
