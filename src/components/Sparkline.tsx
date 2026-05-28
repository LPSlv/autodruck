import { sparklinePath } from '@/lib/tufte';

export function Sparkline({ values, width = 120, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return null;
  const { d } = sparklinePath(values, { width, height, pad: 2 });
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}
