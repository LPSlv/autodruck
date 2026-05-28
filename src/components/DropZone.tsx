import { useRef, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  onFiles: (files: { name: string; text: string }[]) => void;
};

export function DropZone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function readAll(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().endsWith('.gcode'));
    const out = await Promise.all(arr.map(async (f) => ({ name: f.name, text: await f.text() })));
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
