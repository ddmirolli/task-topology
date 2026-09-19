import assert from 'node:assert/strict';
import { startApp } from './server.mjs';

export async function buttons(workspace, browser) {
  const app = await startApp(workspace);
  try {
    for (const theme of ['light', 'dark']) for (const name of ['login', 'signup']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
      try {
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== 'https://tti.invalid') return route.abort();
          const request = route.request();
          let result = await app.http(url.pathname + url.search, { method: request.method(), body: request.postDataBuffer() || undefined,
            headers: request.postDataBuffer() ? { 'content-type': request.headers()['content-type'] || 'application/x-www-form-urlencoded' } : {} });
          // Browserbase proxy egress cannot resolve tti.invalid. Follow local redirects here.
          for (let n = 0; [301, 302, 303].includes(result.status) && n < 5; n++) {
            assert.ok(result.headers.location?.startsWith('/') && !result.headers.location.startsWith('//'));
            result = await app.http(result.headers.location);
          }
          delete result.headers['content-length']; delete result.headers['content-encoding'];
          await route.fulfill({ status: result.status, headers: result.headers, body: result.text });
        });
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        await page.goto(`https://tti.invalid/${name}?theme=${theme}`);
        const button = page.locator(`form[action="/${name}"]`).locator('button[type="submit"], button:not([type]), input[type="submit"]');
        assert.ok(await button.isVisible()); assert.ok(await button.isEnabled());
        const appearance = await button.evaluate(el => {
          const rgb = text => { const m = text.match(/[\d.]+/g)?.map(Number); if (!m || m.length < 3) throw new Error('Unsupported rendered color'); return m; };
          const blend = (fg, bg) => { const a = fg[3] ?? 1; return fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a)); };
          const nodes = []; for (let n = el; n; n = n.parentElement) nodes.unshift(n);
          let background = [255, 255, 255], opacity = 1;
          for (const n of nodes) { const s = getComputedStyle(n); background = blend(rgb(s.backgroundColor), background); opacity *= Number(s.opacity); }
          const s = getComputedStyle(el), foreground = blend(rgb(s.color), background);
          const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
          const a = luminance(foreground), b = luminance(background);
          return { contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), opacity, visibility: s.visibility,
            backgroundAlpha: rgb(s.backgroundColor)[3] ?? 1, backgroundImage: s.backgroundImage };
        });
        assert.ok(appearance.contrast >= 4.5, `${name}/${theme} contrast ${appearance.contrast.toFixed(2)}`);
        assert.equal(appearance.opacity, 1, 'button and ancestors remain opaque');
        assert.equal(appearance.backgroundAlpha, 1, 'button background is opaque');
        assert.equal(appearance.backgroundImage, 'none', 'button background is solid');
        assert.equal(appearance.visibility, 'visible');
        await page.locator('[name=email]').fill(name === 'login' ? 'owner@example.com' : `pilot-${theme}@example.com`);
        await page.locator('[name=password]').fill('password123');
        await button.focus(); assert.ok(await button.evaluate(el => el === document.activeElement));
        if (theme === 'dark') await button.press('Enter'); else await button.click();
        await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
      } finally { await context.close(); }
    }
  } finally { await app.stop(); }
}
