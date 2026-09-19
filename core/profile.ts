import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export interface ExecutionProfile {
  version: 'mtb-execution-profile/1';
  taskSetHash: string;
  graderHash: string;
  client: string;
  clientVersion: string;
  accessMethod: string;
  toolContractHash: string;
  environmentHash: string;
  memoryPolicy: string;
  compactionPolicy: string;
  retryPolicy: string;
  timingPolicy: string;
  limits: { attemptSeconds: number; commandSeconds: number; maxOutputBytes: number };
  settings: Record<string, unknown>;
  tools: string[];
  [key: string]: unknown;
}

export const canonical = (value: unknown): string | undefined => JSON.stringify(sort(value));
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map(key => [key, sort(object[key])]));
  }
  return value;
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
function object(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Supply an object');
}

export function executionProfile(input: unknown): { profile: ExecutionProfile; profileHash: string } {
  object(input);
  assert.equal(input.version, 'mtb-execution-profile/1');
  for (const key of ['taskSetHash', 'graderHash', 'client', 'clientVersion', 'accessMethod', 'toolContractHash', 'environmentHash', 'memoryPolicy', 'compactionPolicy', 'retryPolicy', 'timingPolicy'])
    assert.ok(text(input[key]), `Supply ${key}`);
  for (const key of ['taskSetHash', 'graderHash', 'toolContractHash', 'environmentHash']) {
    const value = input[key]; assert.ok(text(value));
    assert.match(value, /^[a-f0-9]{64}$/, `Invalid ${key}`);
  }
  object(input.limits);
  for (const key of ['attemptSeconds', 'commandSeconds', 'maxOutputBytes']) {
    const value = input.limits[key];
    assert.ok(typeof value === 'number' && Number.isSafeInteger(value) && value > 0, `Supply positive ${key}`);
  }
  object(input.settings);
  assert.ok(Array.isArray(input.tools) && input.tools.length > 0 && input.tools.every(text) && new Set(input.tools).size === input.tools.length, 'Declare unique tools');
  const profile = structuredClone(input) as ExecutionProfile;
  profile.tools.sort();
  const encoded = canonical(profile); assert.ok(encoded);
  return { profile, profileHash: createHash('sha256').update(encoded).digest('hex') };
}

export function compareProfiles(left: unknown, right: unknown): { matched: boolean; differences: string[] } {
  const a = executionProfile(left), b = executionProfile(right);
  return { matched: a.profileHash === b.profileHash,
    differences: [...new Set([...Object.keys(a.profile), ...Object.keys(b.profile)])]
      .filter(key => canonical(a.profile[key]) !== canonical(b.profile[key])).sort() };
}
