// File tool execution stays inside the same sandbox as shell commands.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
try {
  const { action, path: relative, content } = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Use a relative app path');
  const parts = relative.split('/');
  if (parts.some(p => !p || ['.', '..', '.git', '.env', 'node_modules', '.runner-home'].includes(p))) throw new Error('Path is outside the editable app');
  let file = process.cwd();
  for (const part of parts) {
    file = path.join(file, part);
    let stat; try { stat = fs.lstatSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat && (!stat.isFile() && !stat.isDirectory() || stat.isFile() && stat.nlink !== 1)) throw new Error('Only regular unlinked app files are allowed');
  }
  if (action === 'read_file') {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16384) throw new Error('Use a bounded shell read for files over 16 KiB');
      process.stdout.write(JSON.stringify({ value: fs.readFileSync(fd, 'utf8') }));
    } finally { fs.closeSync(fd); }
  } else if (action === 'write_file') {
    if (typeof content !== 'string' || Buffer.byteLength(content) > 262144) throw new Error('File exceeds write limit');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = path.join(path.dirname(file), `.mtb-write-${crypto.randomUUID()}`);
    try { fs.writeFileSync(temp, content, { flag: 'wx' }); fs.renameSync(temp, file); }
    finally { try { fs.unlinkSync(temp); } catch {} }
    process.stdout.write(JSON.stringify({ value: 'written' }));
  } else throw new Error('Unknown file tool');
} catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); process.exitCode = 1; }
