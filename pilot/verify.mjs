import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.mjs';
import { grade } from './grade.mjs';

const browserEnabled = process.argv.includes('--browser');
let connection;
const results = [];
try {
  if (browserEnabled) connection = await (await import('./browserbase.mjs')).connectBrowserbase();
  for (const ticket of browserEnabled ? ['01', '04', '07'] : ['04', '07']) {
    const variants = ['broken', 'reference', 'alternative', ...({ '01': ['partial-signup', 'partial-hidden', 'partial-transparent'], '04': ['partial-no-migration', 'partial-erase-items'], '07': ['partial-reminders', 'partial-sydney-only'] }[ticket])];
    for (const variant of variants) {
      const source = fixture(ticket, variant);
      try {
        const result = await grade(source, ticket, { browser: connection?.browser });
        const expected = ['reference', 'alternative'].includes(variant);
        assert.equal(result.pass, expected, `${ticket}/${variant}: ${JSON.stringify(result.checks)}`);
        results.push({ variant, ...result });
        console.log(`${ticket}/${variant}: correctly ${expected ? 'accepted' : 'rejected'}`);
      } finally { fs.rmSync(source, { recursive: true, force: true }); }
    }
  }
  if (process.env.MTB_RECEIPT) fs.writeFileSync(process.env.MTB_RECEIPT, JSON.stringify({ browserbaseSession: connection?.sessionId, results }, null, 2));
  console.log(`${results.length} fixture verdicts verified. No benchmark model calls.${browserEnabled ? '' : ' Ticket 01 browser checks not run.'}`);
} finally { if (connection) await connection.close(); }
