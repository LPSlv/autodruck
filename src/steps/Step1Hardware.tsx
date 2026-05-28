import { PRINTERS } from '@/lib/presets';
import { cn } from '@/lib/utils';
import type { PrinterId } from '@/lib/gcode';

type Props = {
  printer: PrinterId;
  onPrinter: (p: PrinterId) => void;
};

export function Step1Hardware({ printer, onPrinter }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-medium mb-3">Printer</h2>
        <div className="grid grid-cols-3 gap-2">
          {PRINTERS.map((p) => (
            <button
              key={p.id}
              aria-label={p.label}
              onClick={() => onPrinter(p.id)}
              className={cn(
                'text-left p-4 rounded-md border transition-colors',
                printer === p.id ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
              )}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-muted-foreground">
                {p.buildVolume.join(' × ')} mm
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
