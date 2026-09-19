import test from 'node:test';
import assert from 'node:assert/strict';
import { readableEvidence } from './readable-evidence.mjs';
import { verifyPacket } from './review.mjs';
import { sha256 } from '../pilot/workspace.mjs';

test('readable evidence retains record paths, multiline strings, empty values, and malformed records', () => {
  const raw = JSON.stringify({ content: [{ text: '{"code":0}\n# pass 10\n' }], empty: [], object: {}, flag: false, count: 0, nil: null }) + '\nmalformed\n';
  const rendered = readableEvidence(raw);
  assert.ok(rendered.includes('record 1 ["content",0,"text"] string line 1: {"code":0}'));
  assert.ok(rendered.includes('record 1 ["content",0,"text"] string line 2: # pass 10'));
  assert.ok(rendered.includes('record 1 ["content",0,"text"] string line 3: '));
  for (const value of ['["empty"]: []', '["object"]: {}', '["flag"]: false', '["count"]: 0', '["nil"]: null']) assert.ok(rendered.includes(value));
  assert.ok(rendered.endsWith('record 2 raw: malformed\nrecord 3 raw: '));
});

test('a packet cannot substitute readable evidence while retaining the original transcript', () => {
  const raw = '{"text":"actual result"}';
  const body = { version: 'mtb-review-packet/2', rawSources: { session: raw, events: raw },
    sources: { session: readableEvidence(raw), events: readableEvidence(raw) }, bindings: { session: sha256(raw) } };
  const seal = () => ({ ...body, packetHash: sha256(JSON.stringify(body)) });
  verifyPacket(seal());
  body.sources.session = 'invented result';
  assert.throws(() => verifyPacket(seal()), /Readable evidence changed/);
});
