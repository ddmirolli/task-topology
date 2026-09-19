const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('theme CSS matches the reviewed snapshot', () => {
  assert.equal(
    fs.readFileSync(path.join(__dirname, '../public/theme.css'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'fixtures/theme.css'), 'utf8'),
  );
});
