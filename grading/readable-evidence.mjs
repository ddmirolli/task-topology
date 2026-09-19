// Keep every record and value while displaying JSON strings without escape layers.
// Each field carries its original record number and JSON path.
export function readableEvidence(jsonl) {
  return jsonl.split('\n').map((line, index) => {
    let value;
    try { value = JSON.parse(line); }
    catch { return `record ${index + 1} raw: ${line}`; }
    const output = [];
    function visit(item, path) {
      const prefix = `record ${index + 1} ${JSON.stringify(path)}`;
      if (typeof item === 'string') {
        item.split('\n').forEach((text, n) => output.push(`${prefix} string line ${n + 1}: ${text}`));
      } else if (item !== null && typeof item === 'object' && Object.keys(item).length) {
        for (const [key, child] of Object.entries(item)) visit(child, [...path, Array.isArray(item) ? Number(key) : key]);
      } else output.push(`${prefix}: ${JSON.stringify(item)}`);
    }
    visit(value, []);
    return output.join('\n');
  }).join('\n');
}
