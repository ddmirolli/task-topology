// The ruled design with notional data, so the populated map can be reviewed.
// Dan's ruling on 2026-09-19: A's top nav and front-and-center reading,
// D's tier tabs on the map panel, then a short intro above and results below.
import { Surface } from './Surface.tsx';
import { activePoint, AXES, fmt, Glyph, Mark, MODELS, TIERS, type MockState } from './shared.tsx';

export function Hybrid({ state }: { state: MockState }) {
  const focus = state.focus ?? state.plotted.find(point => state.active[point.model.id] === point.setting) ?? null;
  return (
    <div className="min-h-dvh bg-(--bg) text-(--ink)" style={{ fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>
      <div className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5"><Glyph size={30} /><h1 className="text-[17px] font-semibold tracking-[-0.01em]">Model Topography</h1></div>
          <nav className="flex gap-6 text-[15px] text-(--muted)"><a href="#e" className="hover:text-(--ink)">Method</a><a href="#e" className="hover:text-(--ink)">Data</a></nav>
        </header>

        <p className="max-w-[68ch] pt-2 pb-8 text-[19px] leading-[1.5] text-(--muted)" data-placeholder>
          [Intro, two or three sentences, Dan to write.] Why the Model Topography Benchmark exists and what the map below shows.
        </p>

        <fieldset className="flex items-end gap-1 pl-5 max-sm:pl-2">
          <legend className="sr-only">Tier</legend>
          {TIERS.map(tier => (
            <label key={tier.id} className={`flex min-h-11 items-center rounded-t-xl px-5 text-[15px] leading-tight has-focus-visible:outline-2 has-focus-visible:outline-(--ink) max-sm:px-3 max-sm:text-[13px] ${state.tier === tier.id ? 'bg-(--face) font-semibold' : 'text-(--muted) hover:text-(--ink)'}`}>
              <input type="radio" name="tier-e" className="sr-only" checked={state.tier === tier.id} onChange={() => state.setTier(tier.id)} />{tier.name}
            </label>
          ))}
        </fieldset>

        <section aria-label="Map and reading" className="grid overflow-hidden rounded-[20px] bg-(--face) lg:grid-cols-[minmax(0,1fr)_300px]">
          <Surface state={state} className="aspect-[800/560] w-full lg:aspect-auto lg:h-[min(62vh,620px)]" />
          <div className="flex flex-col justify-between border-(--line) p-7 max-lg:border-t lg:border-l">
            {focus ? (
              <>
                <div>
                  <div className="flex items-center gap-2"><Mark color={state.color(focus.model)} size={14} /><h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{focus.model.name}</h2></div>
                  <p className="mt-1 text-[15px] text-(--muted)">{focus.model.maker}, {focus.setting} reasoning</p>
                </div>
                <dl className="my-6 space-y-5">
                  {AXES.map(axis => (
                    <div key={axis.key}>
                      <dd className="text-[44px] leading-none font-light tracking-[-0.03em] tabular-nums">{fmt.value(focus[axis.key], axis.key === 'intelligence' ? 0 : 1)}</dd>
                      <dt className="mt-1.5 text-[13px] text-(--muted)"><span className="font-semibold text-(--ink) uppercase">{axis.letter}</span> {axis.name}</dt>
                    </div>
                  ))}
                </dl>
                <p className="text-[13px] leading-relaxed text-(--muted) tabular-nums">{focus.successes} of {focus.attempts} attempts succeeded. {fmt.minutes(focus.elapsedMinutes)}, {fmt.usd(focus.costUsd)} API-equivalent.</p>
              </>
            ) : <p className="text-[15px] text-(--muted)">No configuration is plotted for this tier.</p>}
          </div>
        </section>

        <section aria-label="Controls" className="mt-4 flex flex-wrap items-start gap-3">
          <div className="flex flex-1 flex-wrap gap-2">
            {MODELS.map(model => {
              const off = state.hidden.has(model.id);
              return (
                <button key={model.id} type="button" aria-pressed={!off} onClick={() => state.toggleModel(model.id)} className={`flex min-h-11 items-center gap-2 rounded-full bg-(--face) px-4 text-[15px] font-medium ${off ? 'opacity-45' : ''}`}>
                  <Mark color={state.color(model)} />{model.name}<span className="text-[13px] font-normal text-(--muted)">{state.active[model.id]}</span>
                </button>
              );
            })}
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-full bg-(--face) px-4 text-[15px]">
            <span className="font-medium">Reasoning</span><span className="text-[13px] text-(--muted)">Lowest measured</span>
            <input type="range" min={0} max={state.stops - 1} step={1} value={state.stop} onChange={event => state.setStop(Number(event.target.value))} className="h-11 w-40 accent-(--ink)" />
            <span className="text-[13px] text-(--muted)">Highest</span>
          </label>
        </section>

        <section aria-labelledby="e-results" className="mt-14">
          <h2 id="e-results" className="text-[22px] font-semibold tracking-[-0.02em]">Results</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px] tabular-nums">
              <thead className="text-[13px] text-(--muted)"><tr>{['Model', 'Reasoning', 'X workload', 'Y efficiency', 'Z intelligence', 'Succeeded', 'Elapsed', 'Cost'].map((name, i) => <th key={name} scope="col" className={`pb-3 font-normal ${i > 1 ? 'text-right' : ''}`}>{name}</th>)}</tr></thead>
              <tbody>
                {MODELS.map(model => {
                  const point = activePoint(state, model);
                  if (!point) return null;
                  return (
                    <tr key={model.id} onClick={() => state.setFocus(point.id)} className={`cursor-pointer border-t border-(--line) ${state.focusId === point.id ? 'bg-(--face)' : ''}`}>
                      <th scope="row" className="py-3.5 font-medium"><span className="flex items-center gap-2.5"><Mark color={state.color(model)} />{model.name}</span></th>
                      <td className="text-(--muted)">{point.setting}</td>
                      <td className="text-right">{fmt.value(point.workload)}</td><td className="text-right">{fmt.value(point.efficiency)}</td><td className="text-right">{point.intelligence}</td>
                      <td className="text-right">{point.successes} / {point.attempts}</td><td className="text-right">{fmt.minutes(point.elapsedMinutes)}</td><td className="text-right">{fmt.usd(point.costUsd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
