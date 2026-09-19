const test = require('node:test');
const { checks } = require('./checks');
test('05-export-excludes-soft-deleted', checks['05-export-excludes-soft-deleted']);
