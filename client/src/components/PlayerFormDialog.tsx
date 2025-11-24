import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { Player } from "./PlayerCard";

interface PlayerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: Player | null;
  onSave: (player: Omit<Player, 'id'> & { id?: string }) => void;
}

const AVAILABLE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export default function PlayerFormDialog({ open, onOpenChange, player, onSave }: PlayerFormDialogProps) {
  const [name, setName] = useState(player?.name || "");
  const [number, setNumber] = useState(player?.number?.toString() || "");
  const [selectedPositions, setSelectedPositions] = useState<string[]>(player?.positions || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(player?.id && { id: player.id }),
      name,
      number: parseInt(number),
      positions: selectedPositions,
    });
    onOpenChange(false);
    setName("");
    setNumber("");
    setSelectedPositions([]);
  };

  const togglePosition = (position: string) => {
    setSelectedPositions(prev =>
      prev.includes(position)
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-player-form">
        <DialogHeader>
          <DialogTitle className="font-bebas text-2xl tracking-wide">
            {player ? "Edit Player" : "Add New Player"}
          </DialogTitle>
          <DialogDescription>
            {player ? "Update player information" : "Add a new player to your roster"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Player Name</Label>
              <Input
                id="name"
                placeholder="Enter player name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Jersey Number</Label>
              <Input
                id="number"
                type="number"
                placeholder="00"
                min="0"
                max="99"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                data-testid="input-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred Positions</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_POSITIONS.map((position) => (
                  <Badge
                    key={position}
                    variant={selectedPositions.includes(position) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => togglePosition(position)}
                    data-testid={`badge-position-${position}`}
                  >
                    {position}
                    {selectedPositions.includes(position) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="button-save">
              {player ? "Update Player" : "Add Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
