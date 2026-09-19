import test from 'node:test';
import assert from 'node:assert/strict';
import { visiblePoints } from '../.build/core/topography.js';

test('tier and configuration selection never invent missing coordinates or rescale measured points', () => {
  const axis = { status: 'validated', value: 1, unit: 'test', evidenceUrl: '/evidence', methodVersion: 'test' };
  const point = { id: 'a', configuration: { id: 'medium' }, tier: 1, comparisonKey: 'suite-v1', axes: { workload: axis, efficiency: axis, intelligence: axis } };
  const unknown = { ...point, id: 'unknown', axes: { ...point.axes, efficiency: { status: 'unavailable', reason: 'calibration_pending' } } };
  const state = { tier: 1, comparisonKey: 'suite-v1', selectedConfigurationIds: ['medium'],
    points: [point, unknown, { ...point, tier: 3 }, { ...point, comparisonKey: 'suite-v2' }, { ...point, configuration: { id: 'ultra' } }] };
  assert.deepEqual(visiblePoints(state), [point]);
  assert.equal(visiblePoints(state)[0], point);
  assert.deepEqual(visiblePoints({ ...state, selectedConfigurationIds: [] }), []);
  assert.deepEqual(visiblePoints({ ...state, points: [{ ...point, axes: { ...point.axes, workload: { ...axis, value: Infinity } } }] }), []);
  // A point that still uses letter keys has no named axis, so it is never plotted.
  assert.deepEqual(visiblePoints({ ...state, points: [{ ...point, axes: { x: axis, y: axis, z: axis } }] }), []);
});
