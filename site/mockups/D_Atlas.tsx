// Direction D, Atlas. The subject's own vernacular: a survey map sheet. Each tier
// is a sheet. The legend is the model control. The title block carries the reading.
import { Surface } from './Surface.tsx';
import { activePoint, AXES, fmt, Glyph, Mark, MODELS, TIERS, type MockState } from './shared.tsx';

const narrow = { fontVariationSettings: "'wdth' 78" } as const;

export function Atlas({ state }: { state: MockState }) {
  const { focus } = state;
  return (
    <div className="min-h-dvh bg-(--bg) text-[14px] text-(--ink)" style={{ fontFamily: "'Archivo Variable', sans-serif" }}>
      <div className="mx-auto max-w-[1480px] px-4 pt-4 pb-24 lg:px-8">
        <fieldset className="flex items-end gap-1 pl-6">
          <legend className="sr-only">Tier</legend>
          {TIERS.map((tier, index) => (
            <label key={tier.id} className={`flex min-h-11 items-center gap-2 rounded-t-md border border-b-0 border-(--ink) px-4 text-[14px] has-focus-visible:outline-2 has-focus-visible:outline-(--ink) max-sm:px-2.5 ${state.tier === tier.id ? 'relative top-px bg-(--bg) font-semibold' : 'bg-(--face) text-(--muted)'}`}>
              <input type="radio" name="tier-d" className="sr-only" checked={state.tier === tier.id} onChange={() => state.setTier(tier.id)} />
              <span className="tabular-nums" style={narrow}>Sheet {index + 1}</span><span className="max-sm:hidden">{tier.name}</span>
            </label>
          ))}
        </fieldset>

        <section aria-label="Map sheet" className="relative border border-(--ink)">
          <div className="pointer-events-none absolute inset-1.5 border border-(--line)" />
          <Surface state={state} dense labels="all" className="aspect-[800/560] w-full p-2 lg:aspect-auto lg:h-[min(74vh,760px)] lg:p-4 lg:pt-16 lg:pr-[250px]" />

          <div role="group" aria-label="Legend" className="top-6 right-6 w-[236px] border border-(--ink) bg-(--bg) p-4 max-lg:m-4 max-lg:w-auto lg:absolute">
            <h2 className="text-[13px] font-semibold tracking-[0.04em]" style={narrow}>Legend</h2>
            <ul className="mt-2 space-y-0.5">
              {MODELS.map(model => {
                const off = state.hidden.has(model.id), point = activePoint(state, model);
                return (
                  <li key={model.id} className={off ? 'opacity-40' : ''}>
                    <button type="button" aria-pressed={!off} onClick={() => state.toggleModel(model.id)} className="flex min-h-9 w-full items-center gap-2 text-left font-medium"><Mark color={state.color(model)} />{model.name}</button>
                    {model.settings.length > 1 && (
                      <div role="group" aria-label={`${model.name} reasoning`} className="-mt-1 ml-5 flex gap-3 pb-1 text-[12px]" style={narrow}>
                        {model.settings.map(setting => (
                          <button key={setting} type="button" aria-pressed={setting === point?.setting} onClick={() => state.setSetting(model.id, setting)}
                            className={`min-h-7 underline-offset-4 ${setting === point?.setting ? 'font-semibold underline' : 'text-(--muted) hover:text-(--ink)'}`}>{setting}</button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 border-t border-(--line) pt-2 text-[12px] leading-snug text-(--muted)">The mesh between points is interpolation, not measurement.</p>
          </div>

          <div className="top-6 left-6 grid grid-cols-[auto_1fr] border border-(--ink) bg-(--bg) max-lg:m-4 lg:absolute lg:w-[420px]">
            <div className="grid place-items-center border-r border-(--ink) p-3"><Glyph size={44} /></div>
            <div>
              <h1 className="border-b border-(--ink) px-3 py-2 text-[18px] leading-none font-semibold" style={{ fontVariationSettings: "'wdth' 112" }}>Model Topography</h1>
              {focus ? (
                <dl className="grid grid-cols-3 text-[12px]" style={narrow}>
                  <div className="col-span-3 flex items-center gap-2 border-b border-(--line) px-3 py-1.5 text-[14px] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}><Mark color={state.color(focus.model)} />{focus.model.name}<span className="font-normal text-(--muted)">{focus.setting}</span></div>
                  {AXES.map(axis => (
                    <div key={axis.key} className="border-r border-(--line) px-3 py-1.5 last:border-r-0"><dt className="text-(--muted)">{axis.name}</dt><dd className="text-[20px] font-medium tabular-nums" style={{ fontVariationSettings: "'wdth' 100" }}>{fmt.value(axis.key === 'y' ? focus.y : focus[axis.key], axis.key === 'y' ? 0 : 1)}</dd></div>
                  ))}
                </dl>
              ) : <p className="px-3 py-2.5 text-[13px] text-(--muted)">{TIERS[state.tier - 1]?.name} tier. Select a point to read it.</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="d-results" className="mt-10">
          <h2 id="d-results" className="text-[20px] font-semibold" style={{ fontVariationSettings: "'wdth' 112" }}>Results</h2>
          <div className="mt-3 overflow-x-auto border-y border-(--ink)">
            <table className="w-full min-w-[720px] text-left tabular-nums">
              <thead className="text-[12px] text-(--muted)" style={narrow}><tr>{['Model', 'Reasoning', 'Trusted workload', 'External intelligence', 'Execution efficiency', 'Succeeded', 'Elapsed', 'Cost'].map((name, i) => <th key={name} scope="col" className={`py-2 font-normal ${i > 1 ? 'text-right' : ''}`}>{name}</th>)}</tr></thead>
              <tbody>
                {MODELS.map(model => {
                  const point = activePoint(state, model);
                  return point && (
                    <tr key={model.id} onClick={() => state.setFocus(point.id)} className={`cursor-pointer border-t border-(--line) ${state.focusId === point.id ? 'bg-(--face)' : ''}`}>
                      <th scope="row" className="py-2.5 font-medium"><span className="flex items-center gap-2"><Mark color={state.color(model)} />{model.name}</span></th>
                      <td className="text-(--muted)">{point.setting}</td><td className="text-right">{fmt.value(point.x)}</td><td className="text-right">{point.y}</td><td className="text-right">{fmt.value(point.z)}</td>
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
