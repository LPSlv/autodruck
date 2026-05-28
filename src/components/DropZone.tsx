import { useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB

type Props = {
  onFiles: (files: { name: string; text: string }[]) => void;
};

export function DropZone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function readAll(list: FileList | File[]) {
    const arr = Array.from(list);
    const gcodeFiles: File[] = [];
    let has3mf = false;
    let hasOther = false;

    for (const f of arr) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.gcode')) {
        gcodeFiles.push(f);
      } else if (lower.endsWith('.3mf')) {
        has3mf = true;
      } else {
        hasOther = true;
      }
    }

    if (has3mf) {
      toast.error('.3mf import lands in v2 — please slice to .gcode in Bambu Studio');
    }
    if (hasOther) {
      toast.error('Only .gcode files accepted');
    }

    if (gcodeFiles.length === 0) return;

    const hasLarge = gcodeFiles.some((f) => f.size > LARGE_FILE_THRESHOLD);
    if (hasLarge) {
      toast.info('Parsing large file — UI may stutter briefly');
    }

    const out = await Promise.all(gcodeFiles.map(async (f) => ({ name: f.name, text: await f.text() })));
    if (out.length) onFiles(out);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void readAll(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-md p-12 text-center cursor-pointer transition-colors',
        over ? 'border-primary bg-accent' : 'border-border hover:bg-accent/30'
      )}
    >
      <p className="font-medium">Drop sliced .gcode here</p>
      <p className="text-sm text-muted-foreground mt-1">
        or click to pick — Bambu Studio / Orca exports work
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".gcode"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && void readAll(e.target.files)}
      />
    </div>
  );
}
