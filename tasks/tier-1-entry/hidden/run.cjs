const { checks } = require('./checks');
const ticket = process.argv[2];
(async () => {
  const results = [];
  for (const [name, check] of Object.entries(checks)) {
    if (ticket && !name.startsWith(ticket + '-')) continue;
    const cleanup = [];
    try {
      await check({ after: (fn) => cleanup.push(fn) });
      results.push({ name, pass: true });
    } catch (error) { results.push({ name, pass: false, error: error.message }); }
    finally { for (const fn of cleanup.reverse()) await fn(); }
  }
  if (!results.length) throw new Error('No checks selected');
  console.log(JSON.stringify(results));
})().catch((error) => { console.error(error); process.exitCode = 1; });
