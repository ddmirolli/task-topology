import type { ReactNode } from 'react';
import type { AxisMeasurement } from '../../../core/topography.ts';
import { CHART_AXES } from '../axes.ts';
import type { ConfigurationRecord } from '../data/records.ts';
import { costBasisLabel, recorded, seconds, TIER_NAMES, usd } from '../format.ts';
import { ModelMark } from './ModelMark.tsx';

// A validated coordinate reads as a large numeral. A missing one takes one quiet
// line with its reason, so an unscored configuration does not shout.
function Axis({ letter, name, axis }: { letter: string; name: string; axis: AxisMeasurement }) {
  const label = <><span className="font-semibold text-text uppercase">{letter}</span> {name}</>;
  if (axis.status === 'validated') return (
    <div>
      <dd className="text-[44px] leading-none font-light tracking-[-0.03em] tabular-nums">{axis.value}<span className="ml-2 text-[13px] font-normal tracking-normal text-muted">{axis.unit}</span></dd>
      <dt className="mt-1 text-[13px] text-muted">{label}</dt>
    </div>
  );
  return (
    <div className="text-[14px]">
      <dt className="flex items-baseline justify-between gap-3 text-muted"><span>{label}</span><span className="font-medium text-text">Unavailable</span></dt>
      <dd className="text-[13px] text-muted">{axis.reason}</dd>
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

// The reading beside the map: one configuration's coordinates and measurements.
// Configuration, tasks, and evidence stay folded until asked for.
export function Reading({ record, color }: { record: ConfigurationRecord; color: string | undefined }) {
  const { point } = record, { configuration } = point;
  return (
    <div data-point-details={point.id}>
      <div className="flex items-center gap-2">
        <ModelMark color={color} className="size-3.5" />
        <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] break-all">{configuration.displayName}</h2>
      </div>
      <p className="mt-1 text-muted">{configuration.reasoning.label} reasoning, {TIER_NAMES[point.tier].toLowerCase()}</p>

      <dl className="my-5 space-y-3">
        {CHART_AXES.map(entry => <Axis key={entry.axis} letter={entry.letter} name={entry.name} axis={point.axes[entry.axis]} />)}
      </dl>

      <dl className="border-t border-line pt-3 text-[14px]">
        <Row label="App checks passed">{record.appChecksPassed} of {point.attemptCount}</Row>
        <Row label="Graded successes">{point.successCount ?? 'Pending'}</Row>
        <Row label="Elapsed, all attempts">{seconds(point.elapsedSeconds)}</Row>
        <Row label={point.costBasis === 'api_equivalent_token_estimate' ? 'API-equivalent cost' : 'Cost, all attempts'}>{usd(point.costUsd)}</Row>
      </dl>

      <details className="mt-3 border-t border-line pt-1 text-[14px]">
        <summary className="flex min-h-11 items-center font-medium sm:min-h-9">Configuration and evidence</summary>
        {record.tasks.length > 0 && (
          <table className="mb-3 w-full text-left text-[13px] tabular-nums">
            <thead className="text-muted">
              <tr><th scope="col" className="py-1 font-normal">Task</th><th scope="col" className="py-1 text-right font-normal">Checks</th><th scope="col" className="py-1 text-right font-normal">Elapsed</th><th scope="col" className="py-1 text-right font-normal">Cost</th></tr>
            </thead>
            <tbody>
              {record.tasks.map(task => (
                <tr key={task.taskId} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-2 font-medium">{task.taskName}</th>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap">{task.appChecksPassed}/{task.attempts}</td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap">{seconds(task.elapsedSeconds)}</td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap">{usd(task.apiEquivalentUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl>
          <Row label="Requested model ID">{configuration.modelId}</Row>
          <Row label="Registry identity">{configuration.identity ? `${configuration.identity.provider}/${configuration.identity.model} (${configuration.identity.scheme})` : recorded(null)}</Row>
          <Row label="Access method">{recorded(configuration.accessMethod)}</Row>
          <Row label="Client">{configuration.client} {configuration.clientVersion ?? ''}</Row>
          <Row label="Provider value">{recorded(configuration.reasoning.providerValue)}</Row>
          <Row label="Profile hash">{configuration.profileHash ? `${configuration.profileHash.slice(0, 16)}…` : recorded(null)}</Row>
          <Row label="Task set version">{recorded(point.taskSetVersion)}</Row>
          <Row label="Review holds">{record.reviewHolds}</Row>
          <Row label="Cost basis">{costBasisLabel(point.costBasis)}</Row>
          {point.costBasis === 'api_equivalent_token_estimate' && <p className="pb-1 text-right text-[13px] text-muted">A token estimate at dated API prices, not a subscription charge.</p>}
          <Row label="Comparison">{point.comparisonKey}</Row>
        </dl>
        <p className="mt-2"><a href={point.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 sm:min-h-0">Cohort evidence ↗</a></p>
      </details>
    </div>
  );
}
