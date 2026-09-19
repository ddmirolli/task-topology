import { useMemo, useState, type ReactNode } from 'react';
import { isComplete, type AxisMeasurement } from '../../../core/topography.ts';
import { CHART_AXES } from '../axes.ts';
import type { ConfigurationRecord } from '../data/records.ts';
import { seconds, usd } from '../format.ts';
import { ModelMark } from './ModelMark.tsx';

type SortKey = 'model' | 'task' | 'checks' | 'elapsed' | 'cost';
type View = 'configurations' | 'tasks';

interface TableRow {
  key: string;
  record: ConfigurationRecord;
  taskName: string | null;
  attempts: number;
  checks: number;
  elapsed: number | null;
  cost: number | null;
}

interface Props {
  records: readonly ConfigurationRecord[];
  selected: ReadonlySet<string>;
  colors: Readonly<Record<string, string>>;
  focusedPointId: string | null;
  pinnedPointId: string | null;
  onPin(pointId: string): void;
  onHover(pointId: string | null): void;
  // One concise evidence label for the dataset on display.
  note: string | null;
}

const axisCell = (axis: AxisMeasurement): ReactNode =>
  axis.status === 'validated' ? `${axis.value} ${axis.unit}` : <span className="text-muted" title={axis.reason}>Unavailable</span>;

// Missing values sort last in both directions. They never count as zero.
function compare(a: TableRow, b: TableRow, key: SortKey, ascending: boolean): number {
  const direction = ascending ? 1 : -1;
  if (key === 'model') return direction * a.record.point.configuration.displayName.localeCompare(b.record.point.configuration.displayName);
  if (key === 'task') return direction * (a.taskName ?? '').localeCompare(b.taskName ?? '');
  const value = (row: TableRow) => (key === 'checks' ? (row.attempts ? row.checks / row.attempts : null) : key === 'elapsed' ? row.elapsed : row.cost);
  const left = value(a), right = value(b);
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  return direction * (left - right);
}

export function ResultsTable({ records, selected, colors, focusedPointId, pinnedPointId, onPin, onHover, note }: Props) {
  const [view, setView] = useState<View>('configurations');
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: 'model', ascending: true });
  const hasTasks = records.some(record => record.tasks.length > 0);
  // Until a coordinate is validated, one column says so once per row instead of three times.
  const scored = records.some(({ point }) => CHART_AXES.some(entry => point.axes[entry.axis].status === 'validated'));

  const rows = useMemo(() => {
    const built: TableRow[] = view === 'tasks'
      ? records.flatMap(record => record.tasks.map(task => ({
        key: `${record.point.id}:${task.taskId}`, record, taskName: task.taskName, attempts: task.attempts,
        checks: task.appChecksPassed, elapsed: task.elapsedSeconds, cost: task.apiEquivalentUsd,
      })))
      : records.map(record => ({
        key: record.point.id, record, taskName: null, attempts: record.point.attemptCount,
        checks: record.appChecksPassed, elapsed: record.point.elapsedSeconds, cost: record.point.costUsd,
      }));
    return built.sort((a, b) => compare(a, b, sort.key, sort.ascending) || a.key.localeCompare(b.key));
  }, [records, view, sort]);

  const header = (key: SortKey, label: string, className = '') => (
    <th scope="col" aria-sort={sort.key === key ? (sort.ascending ? 'ascending' : 'descending') : 'none'} className={`p-0 font-normal ${className}`}>
      <button type="button" onClick={() => setSort(current => ({ key, ascending: current.key === key ? !current.ascending : true }))}
        className={`flex min-h-11 w-full items-center gap-1 px-3 hover:text-text ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}<span aria-hidden="true" className="w-3 text-xs">{sort.key === key ? (sort.ascending ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );
  const plain = (label: string, className = '') => <th scope="col" className={`px-3 font-normal ${className}`}>{label}</th>;

  return (
    <section aria-labelledby="results-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="results-title" className="text-[22px] font-semibold tracking-[-0.02em]">Results</h2>
          {note && rows.length > 0 && <p className="text-[13px] text-muted" data-evidence-label>{note}</p>}
        </div>
        {hasTasks && (
          <div role="group" aria-label="Table rows" className="flex rounded-full bg-face p-1 text-[14px]">
            {(['configurations', 'tasks'] as const).map(option => (
              <button key={option} type="button" aria-pressed={view === option}
                onClick={() => { setView(option); if (option === 'configurations' && sort.key === 'task') setSort({ key: 'model', ascending: true }); }}
                className={`min-h-11 rounded-full px-4 sm:min-h-8 ${view === option ? 'bg-text font-medium text-bg' : 'text-muted hover:text-text'}`}>{option === 'tasks' ? 'By task' : 'By configuration'}</button>
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[20px] bg-face px-4 py-10 text-center text-muted" data-empty-results>No measurements collected for this tier.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left tabular-nums">
            <caption className="sr-only">Measured configurations for the selected tier. Column buttons change the sort order. Select a model to read its details.</caption>
            <thead className="text-[13px] text-muted">
              <tr>
                {header('model', 'Model')}
                {view === 'tasks' && header('task', 'Task')}
                {plain('Reasoning')}
                {plain('Client', 'hidden md:table-cell')}
                {header('checks', 'App checks', 'text-right')}
                {header('elapsed', 'Elapsed', 'text-right')}
                {header('cost', 'API-equivalent cost', 'text-right')}
                {scored ? CHART_AXES.map(entry => <th key={entry.axis} scope="col" className="hidden px-3 text-right font-normal sm:table-cell"><span className="uppercase">{entry.letter}</span> {entry.axis}</th>)
                  : plain('X, Y, Z coordinates', 'hidden text-right sm:table-cell')}
                {plain('On map', 'hidden text-right md:table-cell')}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const { point } = row.record, { configuration } = point;
                const pinned = pinnedPointId === point.id, focused = focusedPointId === point.id;
                const complete = isComplete(point);
                return (
                  <tr key={row.key} data-point={point.id} onMouseEnter={() => onHover(point.id)} onMouseLeave={() => onHover(null)} onClick={() => onPin(point.id)}
                    className={`cursor-pointer border-t border-line ${pinned ? 'bg-face shadow-[inset_3px_0_0_var(--mtb-text)]' : focused ? 'bg-face' : ''}`}>
                    <th scope="row" className="p-0 font-medium">
                      <button type="button" data-point-trigger={point.id} aria-pressed={pinned} aria-label={`Details for ${configuration.displayName}, ${configuration.reasoning.label} reasoning`}
                        onClick={event => { event.stopPropagation(); onPin(point.id); }} onFocus={() => onHover(point.id)} onBlur={() => onHover(null)}
                        className="flex min-h-11 w-full items-center gap-2 px-3 text-left underline-offset-2 hover:underline">
                        <ModelMark color={colors[configuration.modelId]} />{configuration.displayName}
                      </button>
                    </th>
                    {view === 'tasks' && <td className="px-3">{row.taskName}</td>}
                    <td className="px-3">{configuration.reasoning.label}</td>
                    <td className="hidden px-3 md:table-cell">{configuration.client} {configuration.clientVersion ?? ''}</td>
                    <td className="px-3 text-right">{row.checks} / {row.attempts}</td>
                    <td className="px-3 text-right">{seconds(row.elapsed)}</td>
                    <td className="px-3 text-right">{usd(row.cost)}</td>
                    {scored ? CHART_AXES.map(entry => <td key={entry.axis} className="hidden px-3 text-right sm:table-cell">{axisCell(point.axes[entry.axis])}</td>)
                      : <td className="hidden px-3 text-right text-muted sm:table-cell">Unavailable</td>}
                    <td className="hidden px-3 text-right text-muted md:table-cell">{!selected.has(configuration.id) ? 'Not shown' : complete ? 'Plotted' : 'No coordinates'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
