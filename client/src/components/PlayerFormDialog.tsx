import { useState, useEffect } from "react";
import * as React from "react";
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
import type { Player } from "@shared/schema";

interface PlayerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: Player | null;
  onSave: (player: Omit<Player, 'id' | 'teamId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
}

const AVAILABLE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export default function PlayerFormDialog({ open, onOpenChange, player, onSave }: PlayerFormDialogProps) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  // Update form when player prop or dialog open state changes
  React.useEffect(() => {
    if (open) {
      if (player) {
        setName(player.name || "");
        setNumber(player.number?.toString() || "");
        setSelectedPositions(player.positions || []);
      } else {
        setName("");
        setNumber("");
        setSelectedPositions([]);
      }
    }
  }, [player, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave({
        ...(player?.id && { id: player.id }),
        name,
        number: number || '0', // Store as string to match schema
        positions: selectedPositions,
      });
      // Reset form and close dialog on success
      setName("");
      setNumber("");
      setSelectedPositions([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save player:", error);
      // Keep dialog open on error so user can retry
    }
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
              onClick={() => {
                onOpenChange(false);
                setName("");
                setNumber("");
                setSelectedPositions([]);
              }}
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
