// Direction A, Instrument. After Rams: the page is one device. A face holds the
// map and a numeric readout. Every control sits on one strip under the face.
import { Surface } from './Surface.tsx';
import { activePoint, AXES, fmt, Glyph, Mark, MODELS, TIERS, type MockState } from './shared.tsx';

export function Instrument({ state }: { state: MockState }) {
  const focus = state.focus ?? state.plotted.find(point => state.active[point.model.id] === point.setting) ?? null;
  return (
    <div className="min-h-dvh bg-(--bg) text-(--ink)" style={{ fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>
      <div className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5"><Glyph size={30} /><h1 className="text-[17px] font-semibold tracking-[-0.01em]">Model Topography</h1></div>
          <nav className="flex gap-6 text-[15px] text-(--muted)"><a href="#a" className="hover:text-(--ink)">Method</a><a href="#a" className="hover:text-(--ink)">Data</a></nav>
        </header>

        <section aria-label="Map and reading" className="grid overflow-hidden rounded-[28px] bg-(--face) lg:grid-cols-[minmax(0,1fr)_300px]">
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
                      <dd className="text-[44px] leading-none font-light tracking-[-0.03em] tabular-nums">{fmt.value(axis.key === 'y' ? focus.y : focus[axis.key], axis.key === 'y' ? 0 : 1)}</dd>
                      <dt className="mt-1.5 text-[13px] text-(--muted)"><span className="font-semibold text-(--ink) uppercase">{axis.key}</span> {axis.name}</dt>
                    </div>
                  ))}
                </dl>
                <p className="text-[13px] leading-relaxed text-(--muted) tabular-nums">{focus.successes} of {focus.attempts} attempts succeeded. {fmt.minutes(focus.elapsedMinutes)}, {fmt.usd(focus.costUsd)} API-equivalent.</p>
              </>
            ) : <p className="text-[15px] text-(--muted)">No configuration is plotted for this tier.</p>}
          </div>
        </section>

        <section aria-label="Controls" className="mt-4 flex flex-wrap items-start gap-3">
          <fieldset className="flex rounded-full bg-(--face) p-1">
            <legend className="sr-only">Tier</legend>
            {TIERS.map(tier => (
              <label key={tier.id} className={`flex min-h-9 items-center rounded-full px-5 text-[15px] transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--ink) ${state.tier === tier.id ? 'bg-(--ink) font-medium text-(--bg)' : 'text-(--muted) hover:text-(--ink)'}`}>
                <input type="radio" name="tier-a" className="sr-only" checked={state.tier === tier.id} onChange={() => state.setTier(tier.id)} />{tier.name}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-1 flex-wrap gap-2">
            {MODELS.map(model => {
              const off = state.hidden.has(model.id), index = model.settings.indexOf(state.active[model.id] ?? '');
              const step = (by: number) => state.setSetting(model.id, model.settings[(index + by + model.settings.length) % model.settings.length] ?? '');
              return (
                <div key={model.id} className={`flex min-h-11 items-center rounded-full bg-(--face) pr-1.5 pl-1 ${off ? 'opacity-45' : ''}`}>
                  <button type="button" aria-pressed={!off} onClick={() => state.toggleModel(model.id)} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-medium">
                    <Mark color={state.color(model)} />{model.name}
                  </button>
                  {model.settings.length > 1 && (
                    <span className="flex items-center text-[13px] text-(--muted)">
                      <button type="button" aria-label={`${model.name}: previous reasoning setting`} onClick={() => step(-1)} className="grid size-8 place-items-center rounded-full hover:bg-(--bg)">‹</button>
                      <span className="w-14 text-center tabular-nums">{state.active[model.id]}</span>
                      <button type="button" aria-label={`${model.name}: next reasoning setting`} onClick={() => step(1)} className="grid size-8 place-items-center rounded-full hover:bg-(--bg)">›</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="a-results" className="mt-14">
          <h2 id="a-results" className="text-[22px] font-semibold tracking-[-0.02em]">Results</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px] tabular-nums">
              <thead className="text-[13px] text-(--muted)"><tr>{['Model', 'Reasoning', 'X', 'Y', 'Z', 'Succeeded', 'Elapsed', 'Cost'].map((name, i) => <th key={name} scope="col" className={`pb-3 font-normal ${i > 1 ? 'text-right' : ''}`}>{name}</th>)}</tr></thead>
              <tbody>
                {MODELS.map(model => {
                  const point = activePoint(state, model);
                  if (!point) return null;
                  return (
                    <tr key={model.id} onClick={() => state.setFocus(point.id)} className={`cursor-pointer border-t border-(--line) ${state.focusId === point.id ? 'bg-(--face)' : ''}`}>
                      <th scope="row" className="py-3.5 font-medium"><span className="flex items-center gap-2.5"><Mark color={state.color(model)} />{model.name}</span></th>
                      <td className="text-(--muted)">{point.setting}</td>
                      <td className="text-right">{fmt.value(point.x)}</td><td className="text-right">{point.y}</td><td className="text-right">{fmt.value(point.z)}</td>
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
