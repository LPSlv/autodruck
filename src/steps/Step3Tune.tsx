import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { presetLabel } from '@/lib/presets';
import type { Job } from '@/state';
import type { PrinterId, TuningParams } from '@/lib/gcode';
import type { Stage } from '@/lib/presets';
import { ChevronDown } from 'lucide-react';

type Props = {
  printer: PrinterId;
  stage: Stage;
  jobs: Job[];
  globalDefaults: TuningParams;
  onJobRepeats: (id: string, n: number) => void;
  onOpenAdvanced: () => void;
};

export function Step3Tune({ printer, stage, jobs, globalDefaults, onJobRepeats, onOpenAdvanced }: Props) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{presetLabel(printer, stage)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Cooldown {globalDefaults.cooldownTarget}°C · {globalDefaults.repeats} sweeps · {globalDefaults.zlift}mm zlift · dwell {globalDefaults.dwell}s
            </div>
          </div>
          <Button variant="ghost" onClick={onOpenAdvanced}>Edit defaults</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {jobs.map((job) => (
          <Collapsible key={job.id}>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 truncate font-medium">{job.fileName}</div>
                <label className="flex items-center gap-2 text-sm">
                  Loops
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={job.repeats}
                    onChange={(e) => onJobRepeats(job.id, parseInt(e.target.value, 10) || 1)}
                  />
                </label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Override">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-3 text-sm text-muted-foreground">
                Per-job overrides land in v2 — use the global advanced sheet for now.
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
