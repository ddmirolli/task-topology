// Direction B, Canvas. After the HIG: content fills the window and controls float
// above it on a translucent material. Details and results use progressive disclosure.
import { useState } from 'react';
import { Surface } from './Surface.tsx';
import { activePoint, AXES, fmt, Glyph, Mark, MODELS, TIERS, type MockState } from './shared.tsx';

const material = 'rounded-2xl border border-(--line) bg-(--material) shadow-[0_8px_30px_rgb(0_0_0/0.10)] backdrop-blur-xl';

export function Canvas({ state }: { state: MockState }) {
  const [sheet, setSheet] = useState(false);
  const { focus } = state;
  return (
    <div className="relative h-[calc(100dvh-var(--review-bar,0px))] overflow-hidden bg-(--bg) text-(--ink)" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
      <Surface state={state} labels="all" className="absolute inset-0 size-full px-4 pt-16 pb-24 lg:px-[300px]" />

      <header className={`absolute top-4 left-4 flex items-center gap-2 py-2 pr-4 pl-2.5 ${material}`}>
        <Glyph size={26} /><h1 className="text-[15px] font-semibold">Model Topography</h1>
      </header>

      <fieldset className={`absolute top-4 left-1/2 flex -translate-x-1/2 p-1 max-lg:top-[72px] max-lg:w-[calc(100%-2rem)] ${material} !rounded-full`}>
        <legend className="sr-only">Tier</legend>
        {TIERS.map(tier => (
          <label key={tier.id} className={`flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-center text-[13px] leading-tight whitespace-nowrap has-focus-visible:outline-2 has-focus-visible:outline-(--ink) max-sm:px-2 max-sm:whitespace-normal ${state.tier === tier.id ? 'bg-(--ink) font-medium text-(--bg)' : 'text-(--muted)'}`}>
            <input type="radio" name="tier-b" className="sr-only" checked={state.tier === tier.id} onChange={() => state.setTier(tier.id)} />{tier.name}
          </label>
        ))}
      </fieldset>

      <section aria-label="Models" className={`absolute top-20 left-4 w-[264px] p-2 max-lg:hidden ${material}`}>
        <ul>
          {MODELS.map(model => {
            const off = state.hidden.has(model.id);
            return (
              <li key={model.id} className="flex items-center gap-1 rounded-xl pr-1 hover:bg-(--hover)">
                <button type="button" aria-pressed={!off} onClick={() => state.toggleModel(model.id)} className={`flex min-h-10 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left text-[14px] font-medium ${off ? 'opacity-40' : ''}`}>
                  <Mark color={state.color(model)} />{model.name}
                </button>
                {model.settings.length > 1 && (
                  <select aria-label={`${model.name} reasoning`} value={state.active[model.id]} onChange={event => state.setSetting(model.id, event.target.value)} disabled={off}
                    className="h-8 rounded-lg bg-transparent px-1 text-right text-[13px] text-(--muted) hover:text-(--ink) disabled:opacity-40">
                    {model.settings.map(setting => <option key={setting}>{setting}</option>)}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {!focus && (
        <ul aria-label="Models" className="absolute inset-x-0 bottom-[84px] flex gap-2 overflow-x-auto px-4 lg:hidden">
          {MODELS.map(model => (
            <li key={model.id} className="shrink-0">
              <button type="button" aria-pressed={!state.hidden.has(model.id)} onClick={() => state.toggleModel(model.id)}
                className={`flex min-h-11 items-center gap-2 px-3.5 text-[14px] font-medium ${material} !rounded-full ${state.hidden.has(model.id) ? 'opacity-45' : ''}`}><Mark color={state.color(model)} />{model.name}</button>
            </li>
          ))}
        </ul>
      )}

      {focus && (
        <aside aria-label="Details" className={`absolute top-20 right-4 w-[272px] p-5 max-lg:top-auto max-lg:right-4 max-lg:bottom-20 max-lg:left-4 max-lg:w-auto ${material}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><Mark color={state.color(focus.model)} /><h2 className="text-[17px] font-semibold">{focus.model.name}</h2></div>
              <p className="mt-0.5 text-[13px] text-(--muted)">{focus.model.maker}, {focus.setting} reasoning</p>
            </div>
            <button type="button" aria-label="Close details" onClick={() => state.setFocus(null)} className="grid size-7 place-items-center rounded-full bg-(--hover) text-[13px] text-(--muted)">✕</button>
          </div>
          <dl className="mt-4 divide-y divide-(--line) text-[14px]">
            {AXES.map(axis => (
              <div key={axis.key} className="flex items-baseline justify-between py-2"><dt className="text-(--muted)">{axis.name}</dt><dd className="font-medium tabular-nums">{fmt.value(axis.key === 'y' ? focus.y : focus[axis.key], axis.key === 'y' ? 0 : 1)}</dd></div>
            ))}
            <div className="flex justify-between py-2"><dt className="text-(--muted)">Succeeded</dt><dd className="font-medium tabular-nums">{focus.successes} of {focus.attempts}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-(--muted)">Elapsed</dt><dd className="font-medium tabular-nums">{fmt.minutes(focus.elapsedMinutes)}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-(--muted)">API-equivalent cost</dt><dd className="font-medium tabular-nums">{fmt.usd(focus.costUsd)}</dd></div>
          </dl>
        </aside>
      )}

      <section aria-label="Results" className={`absolute inset-x-4 bottom-4 mx-auto max-w-[980px] overflow-hidden transition-[max-height] duration-300 motion-reduce:transition-none ${material} ${sheet ? 'max-h-[64dvh]' : 'max-h-14'}`}>
        <button type="button" aria-expanded={sheet} onClick={() => setSheet(open => !open)} className="flex h-14 w-full items-center justify-between px-5 text-[14px]">
          <span className="font-semibold">Results</span>
          <span className="text-(--muted) tabular-nums">{state.plotted.length} of {state.tierPoints.length} configurations plotted</span>
          <span aria-hidden="true" className={`text-(--muted) transition-transform motion-reduce:transition-none ${sheet ? 'rotate-180' : ''}`}>⌃</span>
        </button>
        <div className="max-h-[calc(64dvh-3.5rem)] overflow-auto px-5 pb-4">
          <table className="w-full min-w-[640px] text-left text-[14px] tabular-nums">
            <thead className="text-[12px] text-(--muted)"><tr>{['Model', 'Reasoning', 'X', 'Y', 'Z', 'Succeeded', 'Cost'].map((name, i) => <th key={name} scope="col" className={`py-2 font-normal ${i > 1 ? 'text-right' : ''}`}>{name}</th>)}</tr></thead>
            <tbody>
              {MODELS.map(model => {
                const point = activePoint(state, model);
                return point && (
                  <tr key={model.id} onClick={() => state.setFocus(point.id)} className="cursor-pointer border-t border-(--line) hover:bg-(--hover)">
                    <th scope="row" className="py-2.5 font-medium"><span className="flex items-center gap-2"><Mark color={state.color(model)} />{model.name}</span></th>
                    <td className="text-(--muted)">{point.setting}</td><td className="text-right">{fmt.value(point.x)}</td><td className="text-right">{point.y}</td><td className="text-right">{fmt.value(point.z)}</td>
                    <td className="text-right">{point.successes} / {point.attempts}</td><td className="text-right">{fmt.usd(point.costUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
