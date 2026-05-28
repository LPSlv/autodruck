import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

const HINTS = [
  { keys: '← / →', desc: 'Step navigation' },
  { keys: 'Enter', desc: 'Advance / download' },
  { keys: '⌘O', desc: 'Open files' },
  { keys: '⌘K', desc: 'Command palette' },
  { keys: '?', desc: 'This help' }
];

export function KeyboardHints() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onToggle() { setOpen((v) => !v); }
    document.addEventListener('autodruck:toggle-hints', onToggle);
    return () => document.removeEventListener('autodruck:toggle-hints', onToggle);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
          <Keyboard className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Keyboard shortcuts</p>
        <div className="space-y-1">
          {HINTS.map(({ keys, desc }) => (
            <div key={keys} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{keys}</kbd>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
