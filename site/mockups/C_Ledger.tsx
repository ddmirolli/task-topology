// Direction C, Ledger. After the reference benchmark sites: one column, one left
// edge. The table is the control surface. There is no sidebar and no panel.
import { Fragment } from 'react';
import { Surface } from './Surface.tsx';
import { activePoint, fmt, Glyph, Mark, MODELS, TIERS, type MockState } from './shared.tsx';

export function Ledger({ state }: { state: MockState }) {
  return (
    <div className="min-h-dvh bg-(--bg) text-[14px] text-(--ink)" style={{ fontFamily: "'IBM Plex Sans Variable', sans-serif" }}>
      <div className="mx-auto max-w-[1360px] px-5 pb-24 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-x-8 border-b border-(--ink) pt-5">
          <div className="flex items-center gap-2 pb-3"><Glyph size={26} /><h1 className="text-[16px] font-semibold">Model Topography</h1></div>
          <fieldset className="flex gap-7 max-sm:order-3 max-sm:w-full max-sm:justify-between max-sm:gap-2">
            <legend className="sr-only">Tier</legend>
            {TIERS.map(tier => (
              <label key={tier.id} className={`-mb-px flex min-h-11 items-center border-b-2 pb-2 text-[15px] has-focus-visible:outline-2 has-focus-visible:outline-(--ink) ${state.tier === tier.id ? 'border-(--ink) font-semibold' : 'border-transparent text-(--muted) hover:text-(--ink)'}`}>
                <input type="radio" name="tier-c" className="sr-only" checked={state.tier === tier.id} onChange={() => state.setTier(tier.id)} />{tier.name}
              </label>
            ))}
          </fieldset>
          <nav className="flex gap-5 pb-3 text-(--muted)"><a href="#c" className="hover:text-(--ink)">Methodology</a><a href="#c" className="hover:text-(--ink)">Download data</a></nav>
        </header>

        <Surface state={state} labels="all" className="mx-auto aspect-[800/560] w-full lg:aspect-auto lg:h-[min(56vh,600px)]" />

        <div className="overflow-x-auto border-t border-(--ink)">
          <table className="w-full min-w-[900px] text-left tabular-nums [&_td:last-child]:pr-2 [&_th:last-child]:pr-2">
            <caption className="sr-only">Results. Each row controls one model on the map.</caption>
            <thead className="text-[12px] text-(--muted)">
              <tr className="border-b border-(--line)">
                <th scope="col" className="w-10 py-2.5 font-normal"><span className="sr-only">On map</span></th>
                <th scope="col" className="font-normal">Model</th><th scope="col" className="font-normal">Reasoning, measured settings</th>
                {['X workload', 'Y intelligence', 'Z efficiency', 'Succeeded', 'Elapsed', 'Cost'].map(name => <th key={name} scope="col" className="text-right font-normal">{name}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODELS.map(model => {
                const point = activePoint(state, model), off = state.hidden.has(model.id);
                if (!point) return null;
                const open = state.focusId === point.id;
                return (
                  <Fragment key={model.id}>
                    <tr className={`border-b border-(--line) ${off ? 'text-(--muted)' : ''} ${open ? 'bg-(--face)' : ''}`}>
                      <td className="py-0"><label className="grid size-11 place-items-center"><input type="checkbox" className="size-4 accent-(--ink)" checked={!off} onChange={() => state.toggleModel(model.id)} aria-label={`Show ${model.name} on the map`} /></label></td>
                      <th scope="row" className="font-medium">
                        <button type="button" aria-expanded={open} onClick={() => state.setFocus(open ? null : point.id)} className="flex min-h-11 items-center gap-2.5 text-left hover:underline">
                          <Mark color={state.color(model)} />{model.name}<span className="font-normal text-(--muted)">{model.maker}</span>
                        </button>
                      </th>
                      <td>
                        <span className="inline-flex" role="group" aria-label={`${model.name} reasoning`}>
                          {model.settings.map(setting => (
                            <button key={setting} type="button" aria-pressed={setting === point.setting} onClick={() => state.setSetting(model.id, setting)}
                              className={`min-h-8 border-y border-r border-(--line) px-2.5 text-[13px] first:rounded-l first:border-l last:rounded-r ${setting === point.setting ? 'bg-(--ink) text-(--bg)' : 'text-(--muted) hover:text-(--ink)'}`}>{setting}</button>
                          ))}
                        </span>
                      </td>
                      <td className="text-right">{fmt.value(point.x)}</td><td className="text-right">{point.y}</td><td className="text-right">{fmt.value(point.z)}</td>
                      <td className="text-right">{point.successes} / {point.attempts}</td><td className="text-right">{fmt.minutes(point.elapsedMinutes)}</td><td className="text-right">{fmt.usd(point.costUsd)}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-(--line) bg-(--face)">
                        <td /><td colSpan={8} className="pt-1 pb-5">
                          <dl className="grid max-w-[900px] grid-cols-2 gap-x-10 gap-y-2 text-[13px] sm:grid-cols-4">
                            {[['Requested model ID', `${model.id}-2026-08`], ['Client', 'Reference harness 1.4'], ['Cost basis', 'API-equivalent estimate'], ['Task set', 'mtb-tasks/3'],
                              ['Provider value', point.setting], ['Attempts', String(point.attempts)], ['Review holds', '0'], ['Evidence', 'Cohort record']].map(([label, value]) => (
                              <div key={label}><dt className="text-(--muted)">{label}</dt><dd className="font-medium">{value}</dd></div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
