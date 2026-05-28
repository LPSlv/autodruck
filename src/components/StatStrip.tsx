import { Sparkline } from './Sparkline';

export function StatStrip({ items }: { items: { label: string; value: string; series: number[] }[] }) {
  return (
    <div className="grid grid-cols-3 gap-6 border-y py-4">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</div>
          <div className="text-2xl font-medium mt-0.5">{it.value}</div>
          <div className="text-muted-foreground mt-1"><Sparkline values={it.series} /></div>
        </div>
      ))}
    </div>
  );
}
