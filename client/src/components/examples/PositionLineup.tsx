import { useState } from 'react';
import PositionLineup from '../PositionLineup';
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

export default function PositionLineupExample() {
  const [positions, setPositions] = useState<Record<string, Player | null>>({
    P: mockPlayers[1],
    C: mockPlayers[2],
    "1B": mockPlayers[3],
    "2B": mockPlayers[5],
    "3B": mockPlayers[7],
    SS: mockPlayers[0],
    LF: mockPlayers[6],
    CF: mockPlayers[4],
    RF: mockPlayers[8]
  });

  const handleGenerate = () => {
    const shuffled = [...mockPlayers].sort(() => Math.random() - 0.5);
    const positionKeys = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
    const newPositions: Record<string, Player | null> = {};
    
    positionKeys.forEach((pos, index) => {
      newPositions[pos] = shuffled[index] || null;
    });
    
    setPositions(newPositions);
  };

  return (
    <div className="p-6">
      <PositionLineup
        players={mockPlayers}
        positions={positions}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
