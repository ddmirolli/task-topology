import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const brand = join(root, 'public/brand');
const check = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'Unknown argument');
const sizes = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024];
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const qaSizes = [16, 24, 32, 48, 64, 128, 256, 512];
const palettes = {
  light: { foreground: '#111827', background: '#FFFFFF' },
  dark: { foreground: '#F8FAFC', background: '#0B0F14' },
  transparent: { foreground: '#111827' },
};
const pngOptions = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFile = join(brand, 'task-topology-glyph.svg');
const source = await readFile(sourceFile, 'utf8');
const sourceHash = sha256(source);
const reference = await readFile(join(root, 'tti-glyph-c-reference.png'));
const referenceHash = 'b7e55e713d63d5701e7015c7e277bec87e7fe77b86968d77f2a4b357f4b5a2b5';
assert.equal(sha256(reference), referenceHash, 'The immutable reference changed');

// This deliberately narrow SVG grammar prevents hidden styling or a second image source.
const sourcePattern = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512" fill="none" stroke="currentColor" stroke-width="4\.5" stroke-linecap="round" stroke-linejoin="round">\n((?:  <path d="[MCZ0-9.\s-]+"\/>\n)+)<\/svg>\n$/;
const match = source.match(sourcePattern);
assert(match, 'Canonical SVG must contain only the approved root attributes and vector paths');
const geometry = match[1];
const paths = [...geometry.matchAll(/d="([^"]+)"/g)].map(m => m[1]);
assert.equal(paths.length, 8, 'Expected the perimeter and seven internal paths');
for (const path of paths) {
  assert(path.startsWith('M '), 'Each path needs an explicit start');
  for (const segment of path.matchAll(/([MCZ])([^MCZ]*)/g)) {
    const values = segment[2].trim().split(/\s+/).filter(Boolean).map(Number);
    assert.equal(values.length, { M: 2, C: 6, Z: 0 }[segment[1]], 'Invalid path command');
    assert(values.every(v => Number.isFinite(v) && v > 4.5 && v < 507.5), 'Control point risks clipping');
  }
}

function variant(palette) {
  const { foreground, background } = palettes[palette];
  return source.replace('stroke="currentColor"', `stroke="${foreground}"`)
    .replace(geometry, `${background ? `  <rect width="512" height="512" fill="${background}" stroke="none"/>\n` : ''}${geometry}`);
}

function render(svg, size) {
  // Set the SVG viewport before decoding. Each output is a fresh vector rasterization.
  return sharp(Buffer.from(svg.replace('<svg ', `<svg width="${size}" height="${size}" `)), {
    density: 72,
    failOn: 'warning',
  });
}

const outputs = new Map();
function add(path, data) {
  assert(!outputs.has(path), `Duplicate output: ${path}`);
  outputs.set(path, Buffer.isBuffer(data) ? data : Buffer.from(data));
}

const adaptivePath = 'task-topology-glyph-adaptive.svg';
const adaptiveStyle = `  <style>:root{color:${palettes.light.foreground}}@media(prefers-color-scheme:dark){:root{color:${palettes.dark.foreground}}}</style>\n`;
const adaptive = source.replace(geometry, adaptiveStyle + geometry);
assert.equal(adaptive.replace(adaptiveStyle, ''), source, 'Adaptive geometry must match the canonical SVG');
add(adaptivePath, adaptive);
const projectConfig = JSON.parse(await readFile(join(root, 't3.json'), 'utf8'));
assert.equal(projectConfig.iconPath, `public/brand/${adaptivePath}`, 'T3 must use the generated adaptive SVG');

for (const theme of ['light', 'dark']) {
  const svg = variant(theme);
  assert.equal([...svg.matchAll(/<path d="([^"]+)"\/>/g)].map(m => m[0]).join('\n'),
    [...source.matchAll(/<path d="([^"]+)"\/>/g)].map(m => m[0]).join('\n'));
  assert(svg.includes('viewBox="0 0 512 512"') && svg.includes('stroke-width="4.5"'));
  assert(!/transform=|<image|base64|<style/.test(svg));
  add(`task-topology-glyph-${theme}.svg`, svg);
}

for (const theme of Object.keys(palettes)) {
  for (const size of sizes) {
    add(`png/${theme}/task-topology-${size}.png`, await render(variant(theme), size)
      .ensureAlpha().png(pngOptions).toBuffer());
  }
}
for (const theme of ['light', 'dark']) {
  for (const size of [512, 1024]) {
    add(`jpg/task-topology-${theme}-${size}.jpg`, await render(variant(theme), size)
      .removeAlpha().jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer());
  }
}

function makeIco() {
  const header = Buffer.alloc(6 + icoSizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icoSizes.length, 4);
  const entries = [];
  let offset = header.length;
  for (const [index, size] of icoSizes.entries()) {
    const png = outputs.get(`png/light/task-topology-${size}.png`);
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    entries.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries]);
}
add('favicon/favicon.ico', makeIco());

async function decoded(bytes, size, format) {
  const meta = await sharp(bytes, { failOn: 'warning' }).metadata();
  assert.equal(meta.format, format);
  assert.equal(meta.width, size);
  assert.equal(meta.height, size);
  const raw = await sharp(bytes, { failOn: 'warning' }).raw().toBuffer({ resolveWithObject: true });
  assert.equal(raw.data.length, size * size * raw.info.channels, 'Incomplete decode');
  return { ...raw, meta };
}

const bounds = {};
for (const size of sizes) {
  const alpha = await decoded(outputs.get(`png/transparent/task-topology-${size}.png`), size, 'png');
  assert(alpha.meta.hasAlpha && alpha.info.channels === 4, 'Missing transparent alpha');
  let minX = size, minY = size, maxX = -1, maxY = -1, partial = false;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = alpha.data[(y * size + x) * 4 + 3];
    if (a > 0 && a < 255) partial = true;
    if (a > 8) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) assert.equal(a, 0, 'Clipped alpha');
  }
  assert(partial && maxX > minX, 'Empty glyph or missing antialiasing');
  // The reference is wider than it is tall. These are intentional canvas margins.
  for (const [actual, expected] of [[minX, 44.45], [maxX + 1, 467.55], [minY, 144.2], [maxY + 1, 367.8]]) {
    assert(Math.abs(actual - expected * size / 512) <= 1.5, `Unexpected padding at ${size}px`);
  }
  bounds[size] = { minX, minY, maxX, maxY };
  for (const theme of ['light', 'dark']) {
    const image = await decoded(outputs.get(`png/${theme}/task-topology-${size}.png`), size, 'png');
    const bg = palettes[theme].background.match(/[0-9A-Fa-f]{2}/g).map(v => parseInt(v, 16));
    assert.deepEqual([...image.data.subarray(0, 3)], bg);
    for (let i = 3; i < image.data.length; i += 4) assert.equal(image.data[i], 255, 'Background not opaque');
    // Compare all pixels with the same canonical coverage mask, allowing rounding only.
    const fg = palettes[theme].foreground.match(/[0-9A-Fa-f]{2}/g).map(v => parseInt(v, 16));
    for (let i = 0; i < image.data.length; i += 4) for (let c = 0; c < 3; c++) {
      const a = alpha.data[i + 3] / 255;
      assert(Math.abs(image.data[i + c] - (fg[c] * a + bg[c] * (1 - a))) <= 3,
        `Theme coverage differs at ${theme} ${size}px`);
    }
  }
}
for (const theme of ['light', 'dark']) for (const size of [512, 1024]) {
  const jpg = await decoded(outputs.get(`jpg/task-topology-${theme}-${size}.jpg`), size, 'jpeg');
  assert(!jpg.meta.hasAlpha && jpg.info.channels === 3, 'JPEG must contain opaque RGB');
}

const ico = outputs.get('favicon/favicon.ico');
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), icoSizes.length);
let icoOffset = 6 + icoSizes.length * 16;
for (const [index, size] of icoSizes.entries()) {
  const entry = 6 + index * 16;
  assert.equal(ico[entry] || 256, size);
  assert.equal(ico[entry + 1] || 256, size);
  assert.equal(ico.readUInt16LE(entry + 4), 1);
  assert.equal(ico.readUInt16LE(entry + 6), 32);
  assert.equal(ico.readUInt32LE(entry + 12), icoOffset);
  const length = ico.readUInt32LE(entry + 8);
  const png = ico.subarray(icoOffset, icoOffset + length);
  assert(png.equals(outputs.get(`png/light/task-topology-${size}.png`)), 'ICO differs from production PNG');
  await decoded(png, size, 'png');
  icoOffset += length;
}
assert.equal(icoOffset, ico.length, 'ICO has missing or trailing data');

// QA uses the generated PNG bytes. Only the reference comparison uses the original PNG.
const xml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function label(text, width = 512) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28"><text x="0" y="20" font-family="sans-serif" font-size="16" fill="#111827">${xml(text)}</text></svg>`);
}
const layout = [];
const place = (input, left, top) => layout.push({ input, left, top });
place(label('Original reference, aligned for comparison'), 24, 20);
place(label('Canonical production render'), 568, 20);
const alignedReference = await sharp(reference).resize(538, 359).extract({ left: 13, top: 0, width: 512, height: 359 }).png(pngOptions).toBuffer();
const referencePanel = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#FFFFFF' } })
  .composite([{ input: alignedReference, left: 0, top: 71 }]).png(pngOptions).toBuffer();
place(referencePanel, 24, 56);
place(outputs.get('png/light/task-topology-512.png'), 568, 56);
let row = 590;
place(label('Light, native pixels'), 24, row);
place(label('Dark, native pixels'), 568, row);
row += 40;
for (const size of qaSizes) {
  place(label(`${size}px`), 24, row);
  place(label(`${size}px`), 568, row);
  row += 30;
  place(outputs.get(`png/light/task-topology-${size}.png`), 24, row);
  place(outputs.get(`png/dark/task-topology-${size}.png`), 568, row);
  row += size + 20;
}
add('qa/contact-sheet.png', await sharp({ create: { width: 1104, height: row + 4, channels: 3, background: '#E5E7EB' } })
  .composite(layout).png(pngOptions).toBuffer());

const small = [];
for (const [index, size] of [16, 24, 32, 48].entries()) {
  const x = 16 + index * 128;
  small.push({ input: label(`${size}px`, 110), left: x, top: 8 });
  small.push({ input: outputs.get(`png/light/task-topology-${size}.png`), left: x, top: 44 });
  small.push({ input: outputs.get(`png/dark/task-topology-${size}.png`), left: x, top: 110 });
}
add('qa/favicon-native.png', await sharp({ create: { width: 528, height: 176, channels: 3, background: '#E5E7EB' } })
  .composite(small).png(pngOptions).toBuffer());
add('qa/contact-sheet.html', `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Task Topology Index asset QA</title>
<style>body{margin:24px;font:16px system-ui;background:#e5e7eb;color:#111827}table{border-collapse:collapse}th,td{text-align:left;padding:12px;vertical-align:top}img{display:block}figure{margin:0}section{display:flex;gap:32px;flex-wrap:wrap}.reference{width:512px;height:512px;position:relative;overflow:hidden;background:white}.reference img{position:absolute;width:537.6px;height:358.4px;left:-12.1px;top:70.85px}figcaption{margin-bottom:12px}</style>
<h1>Task Topology Index asset QA</h1>
<p>All glyph previews use generated production assets. View at 100% zoom for native CSS pixel sizes.</p>
<section><figure><figcaption>Original reference, aligned for comparison</figcaption><div class="reference"><img src="../../../tti-glyph-c-reference.png" alt="Original approved reference"></div></figure>
<figure><figcaption>Canonical production render</figcaption><img src="../png/light/task-topology-512.png" width="512" height="512" alt="Canonical vector rendered at 512 pixels"></figure></section>
<table><thead><tr><th>Size</th><th>Light</th><th>Dark</th></tr></thead><tbody>
${qaSizes.map(size => `<tr><th>${size}px</th>${['light', 'dark'].map(theme => `<td><img src="../png/${theme}/task-topology-${size}.png" width="${size}" height="${size}" alt="${theme} glyph at ${size} pixels"></td>`).join('')}</tr>`).join('\n')}
</tbody></table></html>
`);

add('qa/adaptive-theme.html', `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Task Topology Index adaptive icon QA</title>
<style>body{margin:24px;font:16px system-ui;background:#e5e7eb;color:#111827}main{display:flex;gap:24px;flex-wrap:wrap}section{padding:24px;border-radius:12px}.light{color-scheme:light;background:${palettes.light.background};color:${palettes.light.foreground}}.dark{color-scheme:dark;background:${palettes.dark.background};color:${palettes.dark.foreground}}.sizes{display:flex;align-items:center;gap:20px}figure{margin:0}figcaption{margin-top:8px}button{margin-bottom:20px;padding:8px 16px}</style>
<h1>Adaptive project icon</h1><p>Both panels load the same SVG as an image. The parent color scheme selects its stroke.</p>
<button type="button" onclick="document.querySelectorAll('section').forEach(panel=>{panel.classList.toggle('light');panel.classList.toggle('dark')})">Swap panel themes</button>
<main>${['light', 'dark'].map(theme => `<section class="${theme}" data-initial-theme="${theme}"><h2>Initially ${theme}</h2><img src="../${adaptivePath}" width="256" height="256" alt="Adaptive glyph"><div class="sizes">${[14, 16, 24, 32, 48].map(size => `<figure><img src="../${adaptivePath}" width="${size}" height="${size}" alt="Adaptive glyph at ${size} pixels"><figcaption>${size}px</figcaption></figure>`).join('')}</div></section>`).join('')}</main></html>
`);

for (const [path, data] of outputs) {
  if (path.endsWith('.png')) await sharp(data, { failOn: 'warning' }).raw().toBuffer();
}
const manifest = {
  source: 'task-topology-glyph.svg', sourceSha256: sourceHash, referenceSha256: referenceHash,
  viewBox: '0 0 512 512', strokeWidth: 4.5, pathCount: paths.length, palettes, sizes, icoSizes,
  renderer: sharp.versions, alphaBounds: bounds,
  files: Object.fromEntries([...outputs].map(([path, data]) => [path, sha256(data)])),
};
add('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
for (const [path, data] of outputs) {
  const destination = join(brand, path);
  if (check) {
    assert((await readFile(destination)).equals(data), `Stale or non-deterministic asset: ${path}`);
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data);
  }
}
assert.equal(sha256(await readFile(sourceFile)), sourceHash, 'Generation modified the canonical SVG');
assert.equal(sha256(await readFile(join(root, 'tti-glyph-c-reference.png'))), referenceHash);
console.log(`${check ? 'Verified' : 'Generated and verified'} 42 production assets, 4 QA files, T3 icon configuration, and the manifest. Geometry and reference unchanged.`);
