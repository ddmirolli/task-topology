const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function renderEmail(name, data) {
  const file = path.join(__dirname, '..', '..', 'emails', name + '.ejs');
  return ejs.render(fs.readFileSync(file, 'utf8'), data);
}

module.exports = { renderEmail };
