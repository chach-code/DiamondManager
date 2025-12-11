import { useState } from "react";
import { ChevronDown, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeams } from "@/hooks/useTeams";
import type { Team } from "@shared/schema";

interface TeamSwitcherProps {
  selectedTeamId: string | null;
  onTeamSelect: (teamId: string) => void;
}

export default function TeamSwitcher({ selectedTeamId, onTeamSelect }: TeamSwitcherProps) {
  const { teams, isLoading, createTeam, deleteTeam, getDefaultTeamId, setLastSelectedTeamId, isCreating, isDeleting } = useTeams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const displayName = selectedTeam?.name || "No Team Selected";

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    
    try {
      const newTeam = await createTeam(newTeamName.trim());
      setNewTeamName("");
      setCreateDialogOpen(false);
      // Auto-select the newly created team
      setLastSelectedTeamId(newTeam.id);
      onTeamSelect(newTeam.id);
    } catch (error) {
      console.error("Failed to create team:", error);
      // TODO: Show error toast
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"? This will also delete all players and lineups for this team.`)) {
      return;
    }

    setDeletingTeamId(teamId);
    try {
      await deleteTeam(teamId);
      // If we deleted the selected team, switch to default
      if (teamId === selectedTeamId) {
        const defaultId = getDefaultTeamId();
        if (defaultId) {
          setLastSelectedTeamId(defaultId);
          onTeamSelect(defaultId);
        }
      }
    } catch (error) {
      console.error("Failed to delete team:", error);
      // TODO: Show error toast
    } finally {
      setDeletingTeamId(null);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[180px] justify-between">
            <span className="truncate">{displayName}</span>
            <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          {teams.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No teams yet
            </div>
          ) : (
            teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => {
                  setLastSelectedTeamId(team.id);
                  onTeamSelect(team.id);
                }}
                className="flex items-center justify-between cursor-pointer"
              >
                <span className={team.id === selectedTeamId ? "font-semibold" : ""}>
                  {team.name}
                </span>
                {teams.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id, team.name);
                    }}
                    disabled={deletingTeamId === team.id || isDeleting}
                  >
                    {deletingTeamId === team.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Enter a name for your new team. You can switch between teams anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="e.g., Spring 2024 Roster"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTeam();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewTeamName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}