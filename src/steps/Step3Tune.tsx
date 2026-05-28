import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  onJobOverride: (id: string, patch: Partial<TuningParams>) => void;
  onOpenAdvanced: () => void;
};

type OverrideField = { key: keyof TuningParams; label: string };

const OVERRIDE_FIELDS: OverrideField[] = [
  { key: 'cooldownTarget', label: 'Cooldown °C' },
  { key: 'dwell',          label: 'Dwell s' },
  { key: 'zlift',          label: 'Z lift mm' },
  { key: 'repeats',        label: 'Repeats' },
  { key: 'pushx',          label: 'Push X' },
  { key: 'returnx',        label: 'Return X' },
  { key: 'parky',          label: 'Park Y' },
  { key: 'parkz',          label: 'Park Z' },
];

export function Step3Tune({ printer, stage, jobs, globalDefaults, onJobRepeats, onJobOverride, onOpenAdvanced }: Props) {
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
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {OVERRIDE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        placeholder={String(globalDefaults[key])}
                        value={job.overrides[key] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            const patch = { ...job.overrides };
                            delete patch[key];
                            onJobOverride(job.id, patch as Partial<TuningParams>);
                          } else {
                            onJobOverride(job.id, { [key]: Number(val) } as Partial<TuningParams>);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
