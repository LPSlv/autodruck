import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { StatStrip } from '@/components/StatStrip';
import { computeCost } from '@/lib/cost';
import { formatDuration, parseDurationStr } from '@/lib/gcode';
import type { Job } from '@/state';
import type { CostSettings } from '@/lib/presets';

type Props = {
  jobs: Job[];
  cost: CostSettings;
  mismatchedCount: number;
};

export function Step4Review({ jobs, cost, mismatchedCount }: Props) {
  const validJobs = jobs.filter((j) => j.metrics && !j.error);
  const breakdowns = validJobs.map((j) => ({ job: j, c: computeCost(j.metrics!, cost, j.repeats) }));
  const totals = breakdowns.reduce(
    (a, { c }) => ({
      filament: a.filament + c.filament,
      electricity: a.electricity + c.electricity,
      labor: a.labor + c.labor,
      depreciation: a.depreciation + c.depreciation,
      failureAdjustment: a.failureAdjustment + c.failureAdjustment,
      total: a.total + c.total
    }),
    { filament: 0, electricity: 0, labor: 0, depreciation: 0, failureAdjustment: 0, total: 0 }
  );
  const totalSeconds = validJobs.reduce((a, j) => a + parseDurationStr(j.metrics!.totalTime) * j.repeats, 0);
  const totalGrams = validJobs.reduce((a, j) => a + j.metrics!.filamentWeightG * j.repeats, 0);

  return (
    <div className="space-y-6">
      {mismatchedCount > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {mismatchedCount} file(s) were sliced for a different printer. Merge is disabled — remove them, or use "Download each" to keep them as standalone files.
        </div>
      )}

      <StatStrip items={[
        { label: 'Time',     value: formatDuration(totalSeconds),   series: validJobs.map((j) => parseDurationStr(j.metrics!.totalTime) * j.repeats) },
        { label: 'Filament', value: totalGrams.toFixed(0) + ' g',   series: validJobs.map((j) => j.metrics!.filamentWeightG * j.repeats) },
        { label: 'Cost',     value: '€ ' + totals.total.toFixed(2), series: breakdowns.map((b) => b.c.total) }
      ]} />

      <Card className="p-2">
        <Table>
          <TableBody>
            {([
              ['Filament',           totals.filament],
              ['Electricity',        totals.electricity],
              ['Labor',              totals.labor],
              ['Depreciation',       totals.depreciation],
              ['Failure adjustment', totals.failureAdjustment]
            ] as Array<[string, number]>)
              .sort((a, b) => b[1] - a[1])
              .map(([label, value]) => {
                const share = totals.total > 0 ? value / totals.total : 0;
                return (
                  <TableRow key={label}>
                    <TableCell className="w-40">{label}</TableCell>
                    <TableCell>
                      <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-foreground"
                          style={{ width: `${share * 100}%` }}
                          aria-label={`${(share * 100).toFixed(0)}% of total`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums w-24">€ {value.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell />
              <TableCell className="text-right font-medium tabular-nums">€ {totals.total.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2">Per-job</h3>
        <Table>
          <TableBody>
            {breakdowns.map(({ job, c }) => (
              <TableRow key={job.id}>
                <TableCell className="truncate max-w-[20rem]">{job.fileName} × {job.repeats}</TableCell>
                <TableCell>{formatDuration(parseDurationStr(job.metrics!.totalTime) * job.repeats)}</TableCell>
                <TableCell className="text-right">€ {c.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
