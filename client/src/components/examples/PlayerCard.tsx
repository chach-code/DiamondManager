import PlayerCard from '../PlayerCard';
import type { Player } from '@shared/schema';

export default function PlayerCardExample() {
  const mockPlayer: Player = {
    id: "1",
    teamId: "team-1",
    name: "Mike Rodriguez",
    number: "24",
    positions: ["SS", "2B", "3B"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <div className="p-6 max-w-2xl">
      <PlayerCard
        player={mockPlayer}
        onEdit={(player) => console.log('Edit player:', player)}
        onDelete={(id) => console.log('Delete player:', id)}
      />
    </div>
  );
}
