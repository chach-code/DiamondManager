import { useState } from 'react';
import PositionLineup from '../PositionLineup';
import type { Player } from '@shared/schema';

const mockPlayers: Player[] = [
  { id: '1', teamId: 'team-1', name: 'Mike Rodriguez', number: '24', positions: ['SS', '2B'], createdAt: new Date(), updatedAt: new Date() },
  { id: '2', teamId: 'team-1', name: 'Jake Thompson', number: '7', positions: ['P', 'OF'], createdAt: new Date(), updatedAt: new Date() },
  { id: '3', teamId: 'team-1', name: 'Chris Martinez', number: '15', positions: ['C'], createdAt: new Date(), updatedAt: new Date() },
  { id: '4', teamId: 'team-1', name: 'Ryan Davis', number: '32', positions: ['1B', '3B'], createdAt: new Date(), updatedAt: new Date() },
  { id: '5', teamId: 'team-1', name: 'Tyler Johnson', number: '11', positions: ['OF'], createdAt: new Date(), updatedAt: new Date() },
  { id: '6', teamId: 'team-1', name: 'Alex Smith', number: '9', positions: ['2B', 'SS'], createdAt: new Date(), updatedAt: new Date() },
  { id: '7', teamId: 'team-1', name: 'Jordan Lee', number: '18', positions: ['OF'], createdAt: new Date(), updatedAt: new Date() },
  { id: '8', teamId: 'team-1', name: 'Kevin Brown', number: '5', positions: ['3B'], createdAt: new Date(), updatedAt: new Date() },
  { id: '9', teamId: 'team-1', name: 'Sam Wilson', number: '21', positions: ['OF'], createdAt: new Date(), updatedAt: new Date() },
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
