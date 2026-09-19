import test from 'node:test';
import assert from 'node:assert/strict';
import { visiblePoints } from '../.build/core/topography.js';

test('tier and configuration selection never invent missing coordinates or rescale measured points', () => {
  const axis = { status: 'validated', value: 1, unit: 'test', evidenceUrl: '/evidence', methodVersion: 'test' };
  const point = { id: 'a', configuration: { id: 'medium' }, tier: 1, comparisonKey: 'suite-v1', axes: { x: axis, y: axis, z: axis } };
  const unknown = { ...point, id: 'unknown', axes: { ...point.axes, z: { status: 'unavailable', reason: 'calibration_pending' } } };
  const state = { tier: 1, comparisonKey: 'suite-v1', selectedConfigurationIds: ['medium'],
    points: [point, unknown, { ...point, tier: 3 }, { ...point, comparisonKey: 'suite-v2' }, { ...point, configuration: { id: 'ultra' } }] };
  assert.deepEqual(visiblePoints(state), [point]);
  assert.equal(visiblePoints(state)[0], point);
  assert.deepEqual(visiblePoints({ ...state, selectedConfigurationIds: [] }), []);
  assert.deepEqual(visiblePoints({ ...state, points: [{ ...point, axes: { ...point.axes, x: { ...axis, value: Infinity } } }] }), []);
});
