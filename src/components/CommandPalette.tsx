import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { PRINTERS } from '@/lib/presets';
import type { PrinterId } from '@/lib/gcode';
import type { Step } from '@/state';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPrinter: PrinterId;
  stepValidity: Record<Step, boolean>;
  canMerge: boolean;
  canDownloadEach: boolean;
  onJump: (s: Step) => void;
  onPickPrinter: (p: PrinterId) => void;
  onOpenAdvanced: () => void;
  onMerge: () => void;
  onDownloadEach: () => void;
};

const STEP_LABELS: Record<Step, string> = {
  hardware: 'Hardware',
  files: 'Files',
  tune: 'Tune',
  review: 'Review'
};

export function CommandPalette(p: Props) {
  return (
    <CommandDialog open={p.open} onOpenChange={p.onOpenChange}>
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Jump to step">
          {(['hardware', 'files', 'tune', 'review'] as Step[]).map((s) => (
            <CommandItem
              key={s}
              disabled={!p.stepValidity[s]}
              onSelect={() => { p.onJump(s); p.onOpenChange(false); }}
            >
              {STEP_LABELS[s]}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Switch printer">
          {PRINTERS.map((pr) => (
            <CommandItem
              key={pr.id}
              onSelect={() => { p.onPickPrinter(pr.id); p.onOpenChange(false); }}
            >
              {pr.label}{pr.id === p.currentPrinter ? '  ·  current' : ''}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { p.onOpenAdvanced(); p.onOpenChange(false); }}>
            Open advanced settings
          </CommandItem>
          <CommandItem
            disabled={!p.canMerge}
            onSelect={() => { p.onMerge(); p.onOpenChange(false); }}
          >
            Download merged ↵
          </CommandItem>
          <CommandItem
            disabled={!p.canDownloadEach}
            onSelect={() => { p.onDownloadEach(); p.onOpenChange(false); }}
          >
            Download each (zip)
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
