import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import type { Step } from '@/state';

const STEPS: { id: Step; title: string }[] = [
  { id: 'hardware', title: 'Hardware' },
  { id: 'files', title: 'Files' },
  { id: 'tune', title: 'Tune' },
  { id: 'review', title: 'Review' }
];

type Props = {
  step: Step;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  ghostAction?: { label: string; onClick: () => void; disabled?: boolean };
  advancedTrigger: React.ReactNode;
  children: React.ReactNode;
};

export function WizardShell({ step, canBack, canNext, onBack, onNext, primaryAction, ghostAction, advancedTrigger, children }: Props) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container py-4 flex items-center gap-3">
          <span className="font-semibold tracking-tight">autodruck</span>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-sm text-muted-foreground">{STEPS[idx]?.title}</span>
          <div className="flex-1" />
          <ol className="flex gap-1.5" aria-label="progress">
            {STEPS.map((s, i) => (
              <li key={s.id}
                  className={cn('h-2 w-2 rounded-full',
                    i <= idx ? 'bg-primary' : 'bg-muted')}
                  aria-current={i === idx ? 'step' : undefined} />
            ))}
          </ol>
          {advancedTrigger}
        </div>
      </header>

      <main className="flex-1">
        <div className="container py-8 max-w-2xl">
          {children}
        </div>
      </main>

      <footer className="border-t sticky bottom-0 bg-background">
        <div className="container py-3 flex items-center gap-2">
          <Button variant="ghost" onClick={onBack} disabled={!canBack}>Back</Button>
          <div className="flex-1" />
          {ghostAction && (
            <Button variant="ghost" onClick={ghostAction.onClick} disabled={ghostAction.disabled}>
              {ghostAction.label}
            </Button>
          )}
          {primaryAction
            ? <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</Button>
            : <Button onClick={onNext} disabled={!canNext}>Next</Button>}
        </div>
      </footer>
    </div>
  );
}

export function AdvancedTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label="Advanced settings" onClick={onClick}>
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
}
