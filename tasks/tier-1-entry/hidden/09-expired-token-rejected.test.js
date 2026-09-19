const test = require('node:test');
const { checks } = require('./checks');
test('09-expired-token-rejected', checks['09-expired-token-rejected']);
