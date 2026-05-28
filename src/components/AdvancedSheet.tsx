import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { presetFor, type CostSettings } from '@/lib/presets';
import type { TuningParams, PrinterId } from '@/lib/gcode';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  printer: PrinterId;
  globalDefaults: TuningParams;
  customTemplates: { pre?: string; post?: string } | null;
  cost: CostSettings;
  onTuningPatch: (patch: Partial<TuningParams>) => void;
  onTemplatesPatch: (t: { pre?: string; post?: string } | null) => void;
  onCostPatch: (patch: Partial<CostSettings>) => void;
};

const TUNING_FIELDS: Array<{ key: keyof TuningParams; label: string; unit?: string }> = [
  { key: 'cooldownTarget', label: 'Cooldown target', unit: '°C' },
  { key: 'cooldownOvershoot', label: 'Cooldown overshoot', unit: '°C' },
  { key: 'dwell', label: 'Dwell after cooldown', unit: 's' },
  { key: 'nozzleTempIdle', label: 'Nozzle idle temp', unit: '°C' },
  { key: 'bedTempReheat', label: 'Bed reheat (0 = off)', unit: '°C' },
  { key: 'zlift', label: 'Z lift', unit: 'mm' },
  { key: 'repeats', label: 'Sweep repeats' },
  { key: 'pushx', label: 'Push X', unit: 'mm' },
  { key: 'returnx', label: 'Return X', unit: 'mm' },
  { key: 'pushspeed', label: 'Push speed', unit: 'mm/min' },
  { key: 'returnspeed', label: 'Return speed', unit: 'mm/min' },
  { key: 'parky', label: 'Park Y', unit: 'mm' },
  { key: 'parkz', label: 'Park Z', unit: 'mm' }
];

const COST_FIELDS: Array<{ key: keyof CostSettings; label: string; unit?: string }> = [
  { key: 'filamentPerKg', label: 'Filament price', unit: '€/kg' },
  { key: 'electricityPerKwh', label: 'Electricity', unit: '€/kWh' },
  { key: 'printerWatts', label: 'Printer draw', unit: 'W' },
  { key: 'laborPerHour', label: 'Labor', unit: '€/h' },
  { key: 'laborMinutesPerPrint', label: 'Labor per print', unit: 'min' },
  { key: 'depreciationPerHour', label: 'Depreciation', unit: '€/h' },
  { key: 'failureRatePct', label: 'Failure rate', unit: '%' }
];

export function AdvancedSheet(p: Props) {
  const preset = presetFor(p.printer);
  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Advanced</SheetTitle></SheetHeader>
        <Tabs defaultValue="tuning" className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="tuning">Tuning</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="cost">Cost</TabsTrigger>
          </TabsList>

          <TabsContent value="tuning" className="space-y-3 mt-4">
            {TUNING_FIELDS.map(({ key, label, unit }) => (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Label htmlFor={`t-${key}`}>{label}{unit && <span className="text-muted-foreground"> ({unit})</span>}</Label>
                <Input
                  id={`t-${key}`}
                  type="number"
                  className="w-24"
                  value={String(p.globalDefaults[key] ?? 0)}
                  onChange={(e) => p.onTuningPatch({ [key]: Number(e.target.value) } as Partial<TuningParams>)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            <div>
              <Label>Pre-print gcode</Label>
              <Textarea
                rows={4}
                value={p.customTemplates?.pre ?? preset.pre}
                onChange={(e) => p.onTemplatesPatch({ ...p.customTemplates, pre: e.target.value })}
              />
            </div>
            <div>
              <Label>Post-print gcode</Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={p.customTemplates?.post ?? preset.post}
                onChange={(e) => p.onTemplatesPatch({ ...p.customTemplates, post: e.target.value })}
              />
            </div>
            <Button variant="ghost" onClick={() => p.onTemplatesPatch(null)}>Reset to preset</Button>
          </TabsContent>

          <TabsContent value="cost" className="space-y-3 mt-4">
            {COST_FIELDS.map(({ key, label, unit }) => (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Label htmlFor={`c-${key}`}>{label}{unit && <span className="text-muted-foreground"> ({unit})</span>}</Label>
                <Input
                  id={`c-${key}`}
                  type="number"
                  className="w-24"
                  value={String(p.cost[key])}
                  onChange={(e) => p.onCostPatch({ [key]: Number(e.target.value) } as Partial<CostSettings>)}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
