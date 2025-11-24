import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

export interface Player {
  id: string;
  name: string;
  number: number;
  positions: string[];
}

interface PlayerCardProps {
  player: Player;
  onEdit: (player: Player) => void;
  onDelete: (id: string) => void;
}

export default function PlayerCard({ player, onEdit, onDelete }: PlayerCardProps) {
  return (
    <Card className="p-4 hover-elevate" data-testid={`card-player-${player.id}`}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary flex items-center justify-center">
          <span className="text-3xl font-bold text-primary-foreground" data-testid={`text-jersey-${player.id}`}>
            {player.number}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate" data-testid={`text-name-${player.id}`}>
            {player.name}
          </h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {player.positions.map((position, index) => (
              <Badge key={index} variant="secondary" className="text-xs" data-testid={`badge-position-${player.id}-${index}`}>
                {position}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(player)}
            data-testid={`button-edit-${player.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(player.id)}
            data-testid={`button-delete-${player.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
