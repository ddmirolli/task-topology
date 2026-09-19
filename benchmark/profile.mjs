import assert from 'node:assert/strict';
import { sha256 } from '../pilot/workspace.mjs';

export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 500;
export function executionProfile(input) {
  assert.equal(input.version, 'tti-execution-profile/1');
  for (const key of ['taskSetHash', 'graderHash', 'client', 'clientVersion', 'accessMethod', 'toolContractHash', 'environmentHash', 'memoryPolicy', 'compactionPolicy', 'retryPolicy', 'timingPolicy'])
    assert.ok(text(input[key]), `Supply ${key}`);
  for (const key of ['taskSetHash', 'graderHash', 'toolContractHash', 'environmentHash'])
    assert.match(input[key], /^[a-f0-9]{64}$/, `Invalid ${key}`);
  for (const key of ['attemptSeconds', 'commandSeconds', 'maxOutputBytes'])
    assert.ok(Number.isSafeInteger(input.limits?.[key]) && input.limits[key] > 0, `Supply positive ${key}`);
  assert.ok(input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings), 'Record provider settings');
  assert.ok(Array.isArray(input.tools) && input.tools.length > 0 && input.tools.every(text) && new Set(input.tools).size === input.tools.length, 'Declare unique tools');
  const profile = structuredClone(input);
  profile.tools.sort();
  return { profile, profileHash: sha256(canonical(profile)) };
}
export function compareProfiles(left, right) {
  const a = executionProfile(left), b = executionProfile(right);
  return { matched: a.profileHash === b.profileHash,
    differences: [...new Set([...Object.keys(a.profile), ...Object.keys(b.profile)])]
      .filter(k => canonical(a.profile[k]) !== canonical(b.profile[k])).sort() };
}
