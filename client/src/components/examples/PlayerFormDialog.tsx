import { useState } from 'react';
import PlayerFormDialog from '../PlayerFormDialog';
import { Button } from '@/components/ui/button';

export default function PlayerFormDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Form Dialog</Button>
      <PlayerFormDialog
        open={open}
        onOpenChange={setOpen}
        onSave={(player) => console.log('Saved player:', player)}
      />
    </div>
  );
}
