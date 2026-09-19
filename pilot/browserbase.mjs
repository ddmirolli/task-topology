import { chromium } from 'playwright-core';

export async function connectBrowserbase() {
  const key = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!key || !projectId) throw new Error('Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID for browser grading.');
  const request = async (path, body) => {
    const response = await fetch('https://api.browserbase.com/v1/' + path, { method: 'POST',
      headers: { 'x-bb-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Browserbase HTTP ${response.status}`);
    return response.json();
  };
  const session = await request('sessions', { projectId, timeout: 600 });
  let browser;
  try { browser = await chromium.connectOverCDP(session.connectUrl); }
  catch (error) { await request(`sessions/${session.id}`, { projectId, status: 'REQUEST_RELEASE' }); throw error; }
  return { browser, sessionId: session.id, close: async () => {
    try { await browser.close(); } finally { await request(`sessions/${session.id}`, { projectId, status: 'REQUEST_RELEASE' }); }
  } };
}
