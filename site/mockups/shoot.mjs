// Screenshots each mock direction in Browserbase. Serves the built mockups by request interception.
//   npx vite build --config vite.mockups.config.ts && node mockups/shoot.mjs [output-directory]
import fs from 'node:fs';
import path from 'node:path';
import { connectBrowserbase } from '../../pilot/browserbase.mjs';

const dist = '/tmp/mtb-mockups-dist', output = process.argv[2] || '/tmp/mtb-mockups-shots', origin = 'https://mtb-mock.invalid';
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
fs.mkdirSync(output, { recursive: true });
const connection = await connectBrowserbase();
try {
  for (const [name, viewport, colorScheme] of [['desktop', { width: 1440, height: 900 }, 'light'], ['dark', { width: 1440, height: 900 }, 'dark'], ['mobile', { width: 390, height: 844 }, 'light']]) {
    const context = await connection.browser.newContext({ viewport, colorScheme, hasTouch: name === 'mobile', isMobile: name === 'mobile' });
    await context.route(url => url.origin === origin, route => {
      const file = path.join(dist, new URL(route.request().url()).pathname);
      return fs.existsSync(file) && fs.statSync(file).isFile() ? route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
    });
    const page = await context.newPage();
    page.on('pageerror', error => console.error('page error', error.message));
    for (const id of (process.argv[3] || 'a,b,c,d,e').split(',')) {
      await page.goto(`${origin}/mockups/index.html#${id}`);
      await page.reload();
      await page.locator('svg g[role=button]').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (name !== 'mobile') await page.locator('svg g[role=button][aria-label^="Basalt 4, high"] circle').last().click();
      await page.screenshot({ path: path.join(output, `${id}-${name}.png`) });
    }
    await context.close();
  }
  console.log('shots in', output);
} finally { await connection.close(); }
