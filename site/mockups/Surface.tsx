// A static illustration of the 3D map for design review. It is not a renderer:
// no camera, no rotation, no picking engine. Astra builds the real one.
import type { MockState, Point } from './shared.tsx';

const W = 800, H = 560, CX = 400, BASE = 236, HALF = 330, DEPTH = 150, RISE = 190, GRID = 12;
const project = (u: number, v: number, n: number): [number, number] => [CX + (u - v) * HALF, BASE + (u + v) * DEPTH - n * RISE];
const norm = (point: Point): [number, number, number] => [(point.x ?? 0) / 10, (point.y - 125) / 45, (point.z ?? 0) / 8];

// Inverse-distance weighting. It is visual interpolation and nothing more.
function heightAt(u: number, v: number, anchors: readonly [number, number, number][]): number {
  let weight = 0, sum = 0;
  for (const [au, av, an] of anchors) { const w = 1 / ((u - au) ** 2 + (v - av) ** 2 + 0.004); weight += w; sum += w * an; }
  return weight ? sum / weight : 0;
}

interface Props { state: MockState; surface?: boolean; paths?: boolean; labels?: 'focus' | 'all'; dense?: boolean; className?: string }

export function Surface({ state, surface = true, paths = true, labels = 'focus', dense = false, className }: Props) {
  const anchors = state.plotted.filter(point => state.active[point.model.id] === point.setting).map(norm);
  const steps = dense ? GRID * 2 : GRID;
  const lines: string[] = [];
  if (surface && anchors.length >= 3) for (let i = 0; i <= steps; i += 1) for (const along of [true, false]) {
    const path = Array.from({ length: steps + 1 }, (_, j) => {
      const [u, v] = along ? [i / steps, j / steps] : [j / steps, i / steps];
      return project(u, v, heightAt(u, v, anchors)).map(value => value.toFixed(1)).join(',');
    });
    lines.push('M' + path.join('L'));
  }
  const floor = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => project(u ?? 0, v ?? 0, 0).join(',')).join(' ');
  const byModel = new Map<string, Point[]>();
  for (const point of state.plotted) byModel.set(point.model.id, [...(byModel.get(point.model.id) ?? []), point]);
  // Far points first, so near points draw on top.
  const ordered = [...state.plotted].sort((a, b) => (norm(a)[0] + norm(a)[1]) - (norm(b)[0] + norm(b)[1]));
  const [zx, zy] = project(0, 1, 0), [xx, xy] = project(0.5, 1, 0), [yx, yy] = project(1, 0.5, 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`Illustration of the ${state.plotted.length} plotted configurations. The results table lists every value.`}>
      <polygon points={floor} fill="none" stroke="var(--grid)" strokeWidth="1" />
      {Array.from({ length: 5 }, (_, i) => (i + 1) / 6).map(t => (
        <g key={t} stroke="var(--grid)" strokeWidth="0.5" opacity="0.7">
          <line x1={project(t, 0, 0)[0]} y1={project(t, 0, 0)[1]} x2={project(t, 1, 0)[0]} y2={project(t, 1, 0)[1]} />
          <line x1={project(0, t, 0)[0]} y1={project(0, t, 0)[1]} x2={project(1, t, 0)[0]} y2={project(1, t, 0)[1]} />
        </g>
      ))}
      <line x1={zx} y1={zy} x2={zx} y2={zy - RISE} stroke="var(--ink)" strokeWidth="1" />
      <g fill="var(--muted)" fontSize="13" style={{ fontFamily: 'inherit' }}>
        <text x={xx - 40} y={xy + 34} textAnchor="middle"><tspan fill="var(--ink)" fontWeight="600">X</tspan> Trusted workload</text>
        <text x={yx + 40} y={yy + 34} textAnchor="middle"><tspan fill="var(--ink)" fontWeight="600">Y</tspan> External intelligence</text>
        <text x={zx - 10} y={zy - RISE - 10} textAnchor="start"><tspan fill="var(--ink)" fontWeight="600">Z</tspan> Execution efficiency</text>
      </g>
      <path d={lines.join('')} fill="none" stroke="var(--ink)" strokeWidth={dense ? 0.45 : 0.6} opacity={dense ? 0.42 : 0.5} />
      {paths && [...byModel.values()].map(points => points.length > 1 && (
        <polyline key={points[0]?.model.id} fill="none" stroke={state.color(points[0]!.model)} strokeWidth="2.5" strokeLinejoin="round"
          points={[...points].sort((a, b) => a.order - b.order).map(point => project(...norm(point)).join(',')).join(' ')} />
      ))}
      {ordered.map(point => {
        const [u, v, n] = norm(point), [px, py] = project(u, v, n), [, fy] = project(u, v, 0);
        const on = state.active[point.model.id] === point.setting, focused = state.focusId === point.id;
        return (
          <g key={point.id} tabIndex={0} role="button" aria-label={`${point.model.name}, ${point.setting} reasoning`} style={{ cursor: 'pointer', outline: 'none' }}
            onClick={() => { state.setSetting(point.model.id, point.setting); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.setSetting(point.model.id, point.setting); } }}
            onFocus={() => state.setFocus(point.id)}>
            <line x1={px} y1={py} x2={px} y2={fy} stroke="var(--ink)" strokeWidth="0.75" strokeDasharray="2 3" opacity={on ? 0.6 : 0.25} />
            <circle cx={px} cy={fy} r="2" fill="var(--ink)" opacity={on ? 0.5 : 0.2} />
            {focused && <circle cx={px} cy={py} r="14" fill="none" stroke="var(--ink)" strokeWidth="1.5" />}
            <circle cx={px} cy={py} r={on ? 8 : 5} fill={state.color(point.model)} stroke="var(--ink)" strokeWidth={on ? 1.25 : 0.75} opacity={on ? 1 : 0.75} />
            {(focused || (labels === 'all' && on)) && (
              <text x={px + 16} y={py + 4} fontSize="13" fontWeight="600" fill="var(--ink)" stroke="var(--bg)" strokeWidth="4" paintOrder="stroke" style={{ fontFamily: 'inherit' }}>
                {point.model.name} <tspan fontWeight="400" fill="var(--muted)">{point.setting}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
