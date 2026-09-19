// Maintainer control process. Available only after the attempt has stopped.
const readline = require('node:readline');
const path = require('node:path');
const { createRequire } = require('node:module');
const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
let app, server;
const reply = (id, result, error) => process.stdout.write(JSON.stringify({ id, result, error }) + '\n');
readline.createInterface({ input: process.stdin }).on('line', async line => {
  let message;
  try {
    message = JSON.parse(line);
    const { id, action, data = {} } = message;
    if (action === 'open') {
      app = appRequire('./app').createApp({ dbFile: data.dbFile, seedData: data.seedData });
      server = app.listen(data.port, '127.0.0.1');
      await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      reply(id, true);
    } else if (action === 'clock') {
      appRequire('./lib/clock').set(data.now); reply(id, true);
    } else if (action === 'remind') {
      const { outbox } = appRequire('./lib/email/send'); outbox.length = 0;
      appRequire('./jobs/remind-overdue').remindOverdue(app.locals.db, new Date(data.now));
      reply(id, outbox);
    } else if (action === 'close') {
      await new Promise(resolve => server.close(resolve)); app.locals.db.close(); reply(id, true);
    } else throw new Error('Unknown control action');
  } catch (error) { reply(message?.id, null, error.message); }
});
