import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";
import type { Player } from "./PlayerCard";

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
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 500 500"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="0" y="0" width="500" height="500" fill="hsl(var(--primary) / 0.08)" rx="8" />
              
              <path
                d="M 250 380 L 120 250 L 250 120 L 380 250 Z"
                fill="hsl(var(--primary) / 0.12)"
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth="2"
              />
              
              <circle cx="250" cy="250" r="8" fill="hsl(var(--primary) / 0.4)" />
              
              <path
                d="M 245 385 L 250 380 L 255 385"
                fill="none"
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth="2"
              />
            </svg>

            <div className="absolute top-[76%] left-1/2 -translate-x-1/2">
              <PositionMarker position="C" player={positions.C} />
            </div>

            <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2">
              <PositionMarker position="P" player={positions.P} />
            </div>

            <div className="absolute top-[50%] left-[24%] -translate-y-1/2">
              <PositionMarker position="1B" player={positions["1B"]} />
            </div>

            <div className="absolute top-[24%] left-1/2 -translate-x-1/2">
              <PositionMarker position="2B" player={positions["2B"]} />
            </div>

            <div className="absolute top-[50%] right-[24%] -translate-y-1/2">
              <PositionMarker position="3B" player={positions["3B"]} />
            </div>

            <div className="absolute top-[34%] right-[34%]">
              <PositionMarker position="SS" player={positions.SS} />
            </div>

            <div className="absolute top-[8%] left-[12%]">
              <PositionMarker position="LF" player={positions.LF} />
            </div>

            <div className="absolute top-[4%] left-1/2 -translate-x-1/2">
              <PositionMarker position="CF" player={positions.CF} />
            </div>

            <div className="absolute top-[8%] right-[12%]">
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
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-1">
          <span className="text-xs font-semibold text-muted-foreground">{position}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" data-testid={`card-position-${position}`}>
      <div className="w-14 h-14 rounded-full bg-primary border-2 border-primary-border flex items-center justify-center mb-1 shadow-md">
        <span className="text-2xl font-bold text-primary-foreground">
          {player.number}
        </span>
      </div>
      <div className="text-center bg-card px-2 py-1 rounded-md shadow-sm border border-card-border">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {position}
        </div>
        <div className="text-xs font-semibold whitespace-nowrap" data-testid={`text-position-name-${position}`}>
          {player.name}
        </div>
      </div>
    </div>
  );
}
