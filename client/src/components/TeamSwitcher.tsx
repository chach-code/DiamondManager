import { useState } from "react";
import { ChevronDown, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

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
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {!isMobile && <span className="text-sm text-green-800 dark:text-green-200 font-medium">Team:</span>}
        <Button variant="outline" size="sm" disabled className="flex-1 sm:flex-initial">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          <span className="hidden sm:inline">Loading...</span>
          <span className="sm:hidden">Loading</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {!isMobile && <span className="text-sm text-green-800 dark:text-green-200 font-medium shrink-0">Team:</span>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-initial min-w-[140px] sm:min-w-[160px] justify-between bg-white dark:bg-gray-800 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 touch-manipulation"
            >
              <span className="truncate font-medium">{displayName}</span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align={isMobile ? "start" : "end"} 
            className="w-[calc(100vw-2rem)] sm:w-[200px] max-w-[280px]"
            sideOffset={4}
          >
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
                className="flex items-center justify-between cursor-pointer min-h-[44px] sm:min-h-[36px] touch-manipulation"
              >
                <span className={team.id === selectedTeamId ? "font-semibold" : ""}>
                  {team.name}
                </span>
                {teams.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 sm:h-6 sm:w-6 p-0 hover:bg-destructive hover:text-destructive-foreground touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id, team.name);
                    }}
                    disabled={deletingTeamId === team.id || isDeleting}
                  >
                    {deletingTeamId === team.id ? (
                      <Loader2 className="h-4 w-4 sm:h-3 sm:w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                    )}
                  </Button>
                )}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="cursor-pointer min-h-[44px] sm:min-h-[36px] touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Team
          </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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