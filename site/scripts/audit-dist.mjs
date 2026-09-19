// Checks the production build for content that must never ship: the synthetic
// development fixture, credentials, private session material, and published
// scores. Run after `npm run build`. Exits non-zero on any finding.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(site, 'dist');
const findings = [];
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const files = walk(dist);

const banned = [
  ['synthetic fixture', /mtb-synthetic-fixture|synthetic-alpha|Synthetic client/],
  ['credential', /VERCEL_TOKEN|BROWSERBASE_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|\bsk-[A-Za-z0-9_-]{20,}|\bbb_live_[A-Za-z0-9]+|Bearer [A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY/],
  ['private session material', /"(transcript|messages|sessionId|receipt|prompt)"\s*:/],
  ['local path', /\/Users\/[A-Za-z0-9._-]+\//],
  ['source map', /sourceMappingURL=/],
];
for (const file of files) {
  const name = path.relative(dist, file);
  if (/\.(map|env)$|^\.env|\.vercel/.test(name)) findings.push(`${name}: file must not ship`);
  if (/\.(woff2|ico)$/.test(name)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of banned) {
    const match = pattern.exec(content);
    if (match) findings.push(`${name}: ${label} (${match[0].slice(0, 40)})`);
  }
}

// Published data must be byte-identical to the reviewed files at the site root.
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const name of ['results.json', 'intelligence.json', 'epoch-source.csv'])
  if (sha(path.join(dist, name)) !== sha(path.join(site, name))) findings.push(`${name}: differs from the source file`);

const results = JSON.parse(fs.readFileSync(path.join(dist, 'results.json'), 'utf8'));
if (results.X !== null || results.MTB !== null) findings.push('results.json: carries a published score');
const allowed = new Set(['ticket', 'model', 'attempts', 'appChecksPassed', 'elapsedSeconds', 'apiEquivalentUsd', 'reviewHolds', 'client', 'effort']);
for (const row of results.rows) for (const key of Object.keys(row)) if (!allowed.has(key)) findings.push(`results.json: unexpected field ${key}`);

if (findings.length > 0) { console.error(findings.join('\n')); process.exit(1); }
console.log(`Audited ${files.length} files in dist. No synthetic data, credentials, private session material, local paths, source maps, or published scores.`);
