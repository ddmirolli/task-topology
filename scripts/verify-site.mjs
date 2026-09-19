// Browserbase check of the built website. With no target it serves site/dist to
// the remote browser through request interception. With a URL it checks that host.
//   node scripts/verify-site.mjs [target-url] [output-directory]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connectBrowserbase } from '../pilot/browserbase.mjs';

const site = fileURLToPath(new URL('../site', import.meta.url));
const dist = path.join(site, 'dist');
const LOCAL = 'https://mtb-qa.invalid/';
const target = process.argv[2] || LOCAL;
const output = process.argv[3] || '/tmp/mtb-site-qa';
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const sha = value => createHash('sha256').update(value).digest('hex');
// Local runs send the deployment's response headers too, so a CSP fault fails the console check.
const headers = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(site, 'vercel.json'), 'utf8')).headers[0].headers.map(({ key, value }) => [key, value]));
const checks = [], errors = [];
const pass = name => { checks.push(name); console.log('ok  ' + name); };

const connection = await connectBrowserbase();
fs.mkdirSync(output, { recursive: true });
try {
  // `results` changes how /results.json answers: 'slow' delays it, 'fail' returns a 500.
  async function open({ viewport, colorScheme = 'light', hasTouch = false, results = 'normal' }) {
    const context = await connection.browser.newContext({ viewport, colorScheme, hasTouch, isMobile: hasTouch,
      ...(bypass && target !== LOCAL ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypass } } : {}) });
    const mode = { results };
    await context.route(url => url.origin === new URL(target).origin, async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/results.json' && mode.results === 'fail') return route.fulfill({ status: 500, body: 'unavailable' });
      if (url.pathname === '/results.json' && mode.results === 'slow') await new Promise(resolve => setTimeout(resolve, 2500));
      if (target !== LOCAL) return route.continue();
      const file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
      if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', headers, body: fs.readFileSync(file) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !/500|results\.json|Measurements failed/.test(message.text())) errors.push(message.text()); });
    return { context, page, mode };
  }
  const shot = (page, name, fullPage = false) => page.screenshot({ path: path.join(output, name + '.png'), fullPage });
  const rows = page => page.locator('tbody tr[data-point]');
  const markHost = page => page.evaluate(() => { document.getElementById('topography-host').dataset.qaMark = 'kept'; });
  const hostKept = page => page.evaluate(() => document.querySelectorAll('#topography-host').length === 1 && document.getElementById('topography-host').dataset.qaMark === 'kept');
  const markColor = (page, model) => page.locator(`[data-model="${model}"] button span[aria-hidden]`).first().evaluate(node => getComputedStyle(node).backgroundColor);

  // Desktop: loading state, then the populated page.
  const desktop = await open({ viewport: { width: 1440, height: 900 }, results: 'slow' });
  const { page } = desktop;
  const response = await page.goto(target);
  assert.equal(response.status(), 200);
  await page.getByText('Loading measurements').first().waitFor();
  assert.equal(await page.locator('#topography-host').count(), 1, 'host is mounted while data loads');
  await shot(page, 'desktop-loading');
  pass('loading state shows in the host and the table');
  await rows(page).first().waitFor();
  desktop.mode.results = 'normal';

  const assets = {};
  for (const name of ['results.json', 'intelligence.json', 'epoch-source.csv']) {
    const got = await page.evaluate(async url => { const r = await fetch(url); return { status: r.status, text: await r.text() }; }, new URL(name, target).href);
    assert.equal(got.status, 200);
    assets[name] = sha(got.text);
    assert.equal(assets[name], sha(fs.readFileSync(path.join(site, name))), `${name} differs from the worktree`);
  }
  pass('published data files match the worktree byte for byte');

  assert.equal(await rows(page).count(), 2);
  const table = await page.locator('[aria-labelledby=results-title] tbody').innerText();
  assert.match(table, /gpt-5\.6-luna[\s\S]*9 \/ 9/); assert.match(table, /gpt-5\.6-terra[\s\S]*8 \/ 9/);
  assert.equal((table.match(/Unavailable/g) || []).length, 2, 'coordinates are unavailable for both rows');
  assert.doesNotMatch(table, /Plotted/, 'no row claims a plotted point');
  assert.equal(await page.locator('#topography-host').getAttribute('data-renderer-status'), 'absent');
  assert.equal(await page.locator('#topography-host').evaluate(node => node.childElementCount), 0, 'the page puts nothing inside the host');
  await page.getByText('The 3D map is not built yet').waitFor();
  assert.match(await page.locator('[data-plotted-count]').innerText(), /^0 of 2/);
  const box = await page.locator('#topography-host').boundingBox();
  assert.ok(box.y + box.height <= 900 && box.height >= 360, `map fits the first desktop viewport (${Math.round(box.height)}px tall)`);
  assert.ok(box.width > 760, `map dominates the first screen (${Math.round(box.width)}px wide)`);
  await shot(page, 'desktop-light');
  pass('real diagnostic rows render, no score is shown, and the empty map state is present');

  // Tier selection keeps the same host element.
  await markHost(page);
  const terraColor = await markColor(page, 'gpt-5.6-terra');
  await page.getByText('Middle management', { exact: true }).click();
  await page.locator('[data-empty-results]').waitFor();
  assert.equal(await rows(page).count(), 0);
  assert.match(await page.locator('#map-title').innerText(), /Middle management/);
  await shot(page, 'desktop-tier-empty');
  await page.getByText('Senior executive', { exact: true }).click();
  await page.locator('[data-empty-results]').waitFor();
  await page.getByText('Entry level', { exact: true }).click();
  await rows(page).first().waitFor();
  assert.ok(await hostKept(page), 'host survives tier changes');
  pass('tier selection works and empty tiers show an honest empty state');

  // Model and reasoning selection.
  const lunaKey = page.locator('[data-model="gpt-5.6-luna"] button').first();
  await lunaKey.click();
  assert.equal(await lunaKey.getAttribute('aria-pressed'), 'false');
  assert.match(await page.locator('tr', { hasText: 'gpt-5.6-luna' }).innerText(), /Not shown/);
  assert.match(await page.locator('tr', { hasText: 'gpt-5.6-terra' }).innerText(), /No coordinates/);
  assert.equal(await markColor(page, 'gpt-5.6-terra'), terraColor, 'a filter does not move a model color');
  assert.equal(await rows(page).count(), 2, 'hidden configurations keep their measurements in the table');
  await lunaKey.click();
  assert.equal(await lunaKey.getAttribute('aria-pressed'), 'true');
  // Only measured settings appear. This cohort has one per model, so there is nothing to step through.
  assert.equal(await page.locator('[data-model="gpt-5.6-terra"] [data-setting]').innerText(), 'medium');
  assert.equal(await page.locator('input[type=range]').count(), 0, 'no reasoning slider while every model has one measured setting');
  await page.getByText('Layers', { exact: true }).click();
  await page.getByLabel('Connecting surface').uncheck();
  await page.getByLabel('Connecting surface').check();
  await page.getByText('Layers', { exact: true }).click();
  assert.ok(await hostKept(page), 'host survives filter changes');
  pass('model and reasoning selection works without touching measurements or colors');

  // Details, task view, and sorting.
  assert.match(await page.locator('[data-point-details]').innerText(), /gpt-5\.6-luna/, 'the reading defaults to the first configuration shown');
  await page.getByRole('button', { name: /Details for gpt-5\.6-terra/ }).click();
  await page.locator('[data-point-details] summary').click();
  const details = await page.locator('[data-point-details]').innerText();
  for (const expected of [/gpt-5\.6-terra/, /Graded successes\s+Pending/, /API-equivalent token estimate/, /not a subscription charge/, /Codex CLI/, /0\.155\.1/, /Customer deletion/, /Not recorded/])
    assert.match(details, expected);
  assert.match(await page.locator('[data-point-details] a', { hasText: 'Cohort evidence' }).getAttribute('href'), /^https:\/\/github\.com\/ddmirolli\/model-topography\/blob\/[a-f0-9]{40}\//);
  await shot(page, 'desktop-details');
  await page.getByRole('button', { name: 'By task' }).click();
  assert.equal(await rows(page).count(), 6);
  await page.getByRole('button', { name: 'Elapsed' }).click();
  const elapsed = await page.locator('tbody tr[data-point] td:nth-child(6)').allTextContents();
  const toSeconds = text => { const m = /(?:(\d+) min )?([\d.]+) s/.exec(text); return Number(m[1] || 0) * 60 + Number(m[2]); };
  assert.deepEqual(elapsed.map(toSeconds), elapsed.map(toSeconds).sort((a, b) => a - b));
  await page.getByRole('button', { name: 'By configuration' }).click();
  pass('details expose configuration, cost basis, tasks and evidence. Task view and sorting work');

  // Keyboard access.
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: /Details for gpt-5\.6-terra/ }).getAttribute('aria-pressed'), 'false', 'Escape unpins the details');
  await page.locator('input[name=tier]:checked').focus();
  await page.keyboard.press('ArrowDown');
  assert.match(await page.locator('#map-title').innerText(), /Middle management/);
  await page.keyboard.press('ArrowUp');
  await rows(page).first().waitFor();
  await page.getByRole('button', { name: /Details for gpt-5\.6-luna/ }).focus();
  assert.match(await page.locator('[data-point-details]').innerText(), /gpt-5\.6-luna/, 'keyboard focus previews details');
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: /Details for gpt-5\.6-luna/ }).getAttribute('aria-pressed'), 'true');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none', 'keyboard focus is visible');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Method', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Methodology and caveats' }).waitFor();
  await shot(page, 'desktop-methodology');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Methodology and caveats' }).waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Method', 'focus returns to the opener');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  assert.equal(await page.locator('dialog[open] a[href="/results.json"]').count(), 1);
  await page.getByText('266 of 266 models').waitFor();
  await page.getByLabel('Filter by model or organization').fill('Claude Fable 5.1');
  await page.getByText('1 of 266 models').waitFor();
  // Escape in a search field clears it first, so close with the button.
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('heading', { name: 'Data', exact: true }).waitFor({ state: 'hidden' });
  pass('tier radios, table rows, dialogs and Escape all work from the keyboard');

  // Theme follows the system setting. The page has no theme control.
  const background = target => target.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await background(page), 'rgb(243, 243, 243)');
  assert.equal(await page.getByRole('button', { name: /theme|dark|light/i }).count(), 0, 'no theme control');
  await desktop.context.close();
  const system = await open({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await system.page.goto(target); await rows(system.page).first().waitFor();
  assert.equal(await background(system.page), 'rgb(15, 15, 15)', 'a dark system setting gives the dark palette');
  assert.notEqual(await markColor(system.page, 'gpt-5.6-terra'), terraColor, 'model colors have a dark variant');
  await system.page.getByRole('button', { name: /Details for gpt-5\.6-luna/ }).click();
  await shot(system.page, 'desktop-dark');
  await system.page.emulateMedia({ colorScheme: 'light' });
  assert.equal(await background(system.page), 'rgb(243, 243, 243)', 'the palette follows a live system change');
  // The synthetic fixture must not load in a production build.
  await system.page.goto(new URL('?fixture=synthetic', target).href); await rows(system.page).first().waitFor();
  assert.equal(await system.page.getByText(/synthetic/i).count(), 0);
  assert.equal(await rows(system.page).count(), 2);
  await system.context.close();
  pass('light and dark follow the system setting with no toggle, and the synthetic fixture is absent');

  // Load failure and retry.
  const failing = await open({ viewport: { width: 1280, height: 800 }, results: 'fail' });
  await failing.page.goto(target);
  await failing.page.getByText('Measurements could not be loaded').first().waitFor();
  assert.equal(await failing.page.locator('#topography-host').count(), 1);
  await shot(failing.page, 'desktop-load-error');
  failing.mode.results = 'normal';
  await failing.page.getByRole('button', { name: 'Retry' }).click();
  await rows(failing.page).first().waitFor();
  await failing.context.close();
  pass('a load failure shows an error with a working retry');

  // Mobile: no 3D gesture is needed to read results.
  const mobile = await open({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const phone = mobile.page;
  await phone.goto(target); await rows(phone).first().waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page-level horizontal overflow');
  const phoneHost = await phone.locator('#topography-host').boundingBox();
  assert.ok(phoneHost.y + phoneHost.height <= 844, 'tier control and map fit the first mobile screen');
  const small = await phone.evaluate(() => [...document.querySelectorAll('button, label:has(input), a[href], summary')]
    .filter(node => node.getClientRects().length && node.getBoundingClientRect().height < 43.5).map(node => node.textContent.trim().slice(0, 30)));
  assert.deepEqual(small, [], 'every visible control is at least 44px tall');
  await shot(phone, 'mobile-light');
  await shot(phone, 'mobile-light-full', true);
  await phone.getByText('Middle management', { exact: true }).tap();
  await phone.locator('[data-empty-results]').waitFor();
  await phone.getByText('Entry level', { exact: true }).tap();
  await phone.getByRole('button', { name: /Details for gpt-5\.6-terra/ }).tap();
  assert.match(await phone.locator('[data-point-details]').innerText(), /gpt-5\.6-terra[\s\S]*API-equivalent cost/, 'the reading under the map follows the selection');
  await phone.locator('[data-point-details]').scrollIntoViewIfNeeded();
  await shot(phone, 'mobile-details');
  await phone.emulateMedia({ colorScheme: 'dark' });
  await phone.evaluate(() => scrollTo(0, 0));
  await shot(phone, 'mobile-dark');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.context.close();
  pass('mobile layout has no overflow, 44px targets, tier switching and a reading under the map');

  assert.deepEqual(errors, [], 'no page or console errors');
  pass('no page or console errors');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ url: target, sourceCommit, session: connection.sessionId, assets, checks, errors }, null, 2));
  console.log(`\n${checks.length} checks passed. Browserbase session ${connection.sessionId}. Evidence in ${output}`);
} finally { await connection.close(); }
