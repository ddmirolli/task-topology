const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDb(file = ':memory:') {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  const dir = path.join(__dirname, 'migrations');
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue;
    db.exec(fs.readFileSync(path.join(dir, name), 'utf8'));
    db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
  }

  // Query counter, used by the performance tests.
  const stats = { queries: 0 };
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = prepare(sql);
    for (const method of ['all', 'get', 'run']) {
      const original = stmt[method].bind(stmt);
      stmt[method] = (...args) => { stats.queries += 1; return original(...args); };
    }
    return stmt;
  };
  db.stats = stats;
  return db;
}

module.exports = { openDb };
