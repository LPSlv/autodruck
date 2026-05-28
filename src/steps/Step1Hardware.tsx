import { PRINTERS } from '@/lib/presets';
import { cn } from '@/lib/utils';
import type { PrinterId } from '@/lib/gcode';
import type { Stage } from '@/lib/presets';

type Props = {
  printer: PrinterId;
  stage: Stage;
  onPrinter: (p: PrinterId) => void;
  onStage: (s: Stage) => void;
};

export function Step1Hardware({ printer, stage, onPrinter, onStage }: Props) {
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

      <section>
        <h2 className="text-lg font-medium mb-3">Stage</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { s: 1 as Stage, title: 'Stage 1', sub: 'manual ramp — head sweeps part off plate' },
            { s: 2 as Stage, title: 'Stage 2', sub: 'powered actuator — servo or solenoid kick' }
          ].map(({ s, title, sub }) => (
            <button
              key={s}
              onClick={() => onStage(s)}
              className={cn(
                'text-left p-4 rounded-md border transition-colors',
                stage === s ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
              )}
            >
              <div className="font-medium">{title}</div>
              <div className="text-xs text-muted-foreground">{sub}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
