import { useState } from 'react';
import BattingLineup from '../BattingLineup';
import type { Player } from '../PlayerCard';

const mockPlayers: Player[] = [
  { id: '1', name: 'Mike Rodriguez', number: 24, positions: ['SS', '2B'] },
  { id: '2', name: 'Jake Thompson', number: 7, positions: ['P', 'OF'] },
  { id: '3', name: 'Chris Martinez', number: 15, positions: ['C'] },
  { id: '4', name: 'Ryan Davis', number: 32, positions: ['1B', '3B'] },
  { id: '5', name: 'Tyler Johnson', number: 11, positions: ['OF'] },
  { id: '6', name: 'Alex Smith', number: 9, positions: ['2B', 'SS'] },
  { id: '7', name: 'Jordan Lee', number: 18, positions: ['OF'] },
  { id: '8', name: 'Kevin Brown', number: 5, positions: ['3B'] },
  { id: '9', name: 'Sam Wilson', number: 21, positions: ['OF'] },
];

export default function BattingLineupExample() {
  const [lineup, setLineup] = useState<Player[]>([]);

  const handleGenerate = () => {
    const shuffled = [...mockPlayers].sort(() => Math.random() - 0.5);
    setLineup(shuffled.slice(0, 9));
  };

  return (
    <div className="p-6 max-w-2xl">
      <BattingLineup
        players={mockPlayers}
        lineup={lineup}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
