// Old CSV export from the previous system. Not wired up. Do not modify.
function exportCsv(rows) {
  return rows.map((r) => [r.number, r.client, r.total].join(',')).join('\n');
}
module.exports = { exportCsv };
