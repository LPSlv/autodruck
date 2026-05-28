import { DropZone } from '@/components/DropZone';
import { JobRow } from '@/components/JobRow';
import type { Job } from '@/state';
import type { PrinterId } from '@/lib/gcode';

type Props = {
  jobs: Job[];
  printer: PrinterId;
  onAdd: (files: { name: string; text: string }[]) => void;
  onRemove: (id: string) => void;
};

export function Step2Files({ jobs, printer, onAdd, onRemove }: Props) {
  return (
    <div className="space-y-6">
      <DropZone onFiles={onAdd} />
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((j) => (
            <JobRow key={j.id} job={j} selectedPrinter={printer} onRemove={() => onRemove(j.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
