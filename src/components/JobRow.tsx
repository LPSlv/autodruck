import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatDuration, parseDurationStr, type PrinterId } from '@/lib/gcode';
import type { Job } from '@/state';

type Props = {
  job: Job;
  selectedPrinter: PrinterId;
  onRemove: () => void;
};

export function JobRow({ job, selectedPrinter, onRemove }: Props) {
  const mismatched = job.detectedPrinter && job.detectedPrinter !== selectedPrinter;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{job.fileName}</span>
            {job.detectedPrinter && (
              <Badge variant={mismatched ? 'destructive' : 'secondary'}>
                {job.detectedPrinter}
              </Badge>
            )}
            {job.alreadyProcessed && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                already processed
              </Badge>
            )}
          </div>
          {job.metrics && (
            <div className="text-sm text-muted-foreground mt-1">
              {formatDuration(parseDurationStr(job.metrics.totalTime))} ·{' '}
              {job.metrics.filamentWeightG.toFixed(1)}g filament
            </div>
          )}
          {job.error && (
            <div className="text-sm text-destructive mt-2">{job.error}</div>
          )}
          {mismatched && !job.error && (
            <div className="text-sm text-yellow-700 mt-2">
              Sliced for {job.detectedPrinter} but you picked {selectedPrinter}.
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
