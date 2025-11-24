import PlayerCard from '../PlayerCard';

export default function PlayerCardExample() {
  return (
    <div className="p-6 max-w-2xl">
      <PlayerCard
        player={{
          id: "1",
          name: "Mike Rodriguez",
          number: 24,
          positions: ["SS", "2B", "3B"]
        }}
        onEdit={(player) => console.log('Edit player:', player)}
        onDelete={(id) => console.log('Delete player:', id)}
      />
    </div>
  );
}
