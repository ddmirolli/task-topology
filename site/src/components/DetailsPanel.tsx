import type { ReactNode } from 'react';
import type { AxisMeasurement } from '../../../core/topography.ts';
import type { ConfigurationRecord } from '../data/records.ts';
import { costBasisLabel, recorded, seconds, TIER_NAMES, usd } from '../format.ts';
import { ModelMark } from './ModelMark.tsx';

const AXES = [
  { key: 'x', name: 'Trusted workload' },
  { key: 'y', name: 'External intelligence' },
  { key: 'z', name: 'Execution efficiency' },
] as const;

function Axis({ letter, name, axis }: { letter: string; name: string; axis: AxisMeasurement }) {
  return (
    <div className="py-2">
      <dt className="flex items-baseline justify-between gap-3">
        <span><span className="font-semibold uppercase">{letter}</span> <span className="text-muted">{name}</span></span>
        {axis.status === 'validated'
          ? <span className="font-medium tabular-nums">{axis.value} <span className="text-muted">{axis.unit}</span></span>
          : <span className="font-medium">Unavailable</span>}
      </dt>
      <dd className="mt-0.5 text-xs text-muted">
        {axis.status === 'validated'
          ? <>Method {axis.methodVersion}. <a href={axis.evidenceUrl} className="underline underline-offset-2">Evidence</a></>
          : axis.reason}
      </dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words tabular-nums">{children}</dd>
    </div>
  );
}

const heading = 'mt-4 border-t border-line pt-3 text-xs font-semibold';

export function PointDetails({ record, color }: { record: ConfigurationRecord; color: string | undefined }) {
  const { point } = record, { configuration } = point;
  return (
    <div className="text-sm" data-point-details={point.id}>
      <div className="flex items-center gap-2">
        <ModelMark color={color} />
        <h3 className="text-base font-semibold break-all">{configuration.displayName}</h3>
      </div>
      <p className="mt-0.5 text-muted">{configuration.reasoning.label} reasoning, {TIER_NAMES[point.tier].toLowerCase()} tier</p>

      <h4 className={heading}>Coordinates</h4>
      <dl className="divide-y divide-line">
        {AXES.map(axis => <Axis key={axis.key} letter={axis.key} name={axis.name} axis={point.axes[axis.key]} />)}
      </dl>

      <h4 className={heading}>Measurements</h4>
      <dl className="mt-1">
        <Row label="Attempts">{point.attemptCount}</Row>
        <Row label="App checks passed">{record.appChecksPassed} of {point.attemptCount}</Row>
        <Row label="Graded successes">{point.successCount ?? 'Pending transcript grading'}</Row>
        <Row label="Review holds">{record.reviewHolds}</Row>
        <Row label="Elapsed, all attempts">{seconds(point.elapsedSeconds)}</Row>
        <Row label="Cost, all attempts">{usd(point.costUsd)}</Row>
        <Row label="Cost basis">{costBasisLabel(point.costBasis)}</Row>
      </dl>
      {point.costBasis === 'api_equivalent_token_estimate' && (
        <p className="mt-1 text-xs text-muted">Token estimate at dated API prices. It is not a subscription charge.</p>
      )}

      {record.tasks.length > 0 && (
        <>
          <h4 className={heading}>By task</h4>
          <table className="mt-1 w-full text-left text-xs tabular-nums">
            <thead className="text-muted">
              <tr><th scope="col" className="py-1 font-normal">Task</th><th scope="col" className="py-1 text-right font-normal">Checks</th><th scope="col" className="py-1 text-right font-normal">Elapsed</th><th scope="col" className="py-1 text-right font-normal">Cost</th></tr>
            </thead>
            <tbody>
              {record.tasks.map(task => (
                <tr key={task.taskId} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-2 font-medium">{task.taskName}</th>
                  <td className="py-1.5 text-right">{task.appChecksPassed}/{task.attempts}</td>
                  <td className="py-1.5 text-right">{seconds(task.elapsedSeconds)}</td>
                  <td className="py-1.5 text-right">{usd(task.apiEquivalentUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h4 className={heading}>Configuration</h4>
      <dl className="mt-1">
        <Row label="Requested model ID"><code className="font-sans">{configuration.modelId}</code></Row>
        <Row label="Vendor">{recorded(configuration.vendor)}</Row>
        <Row label="Client">{configuration.client}</Row>
        <Row label="Client version">{recorded(configuration.clientVersion)}</Row>
        <Row label="Reasoning setting">{configuration.reasoning.label}</Row>
        <Row label="Provider value">{recorded(configuration.reasoning.providerValue)}</Row>
        <Row label="Profile hash">{configuration.profileHash ? <code className="font-sans break-all">{configuration.profileHash.slice(0, 16)}…</code> : recorded(null)}</Row>
        <Row label="Task set version">{recorded(point.taskSetVersion)}</Row>
        <Row label="Comparison">{point.comparisonKey}</Row>
      </dl>
      <p className="mt-3">
        <a href={point.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 lg:min-h-0">Cohort evidence ↗</a>
      </p>
    </div>
  );
}
