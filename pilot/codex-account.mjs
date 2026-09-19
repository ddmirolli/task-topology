import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function codexAccount(binary = 'codex') {
  const child = spawn(binary, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'ignore'], env: Object.fromEntries(['PATH', 'HOME', 'CODEX_HOME', 'LANG'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]])) });
  const pending = new Map(); let next = 0, buffer = '';
  const fail = error => { for (const item of pending.values()) item.reject(error); pending.clear(); };
  child.on('error', fail);
  child.on('close', () => fail(new Error('Account reader closed')));
  child.stdin.on('error', fail);
  const timer = setTimeout(() => { fail(new Error('Account read timed out')); child.kill('SIGKILL'); }, 30000);
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 4_000_000) { fail(new Error('Account response exceeded limit')); child.kill('SIGKILL'); return; }
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try {
        const response = JSON.parse(line), item = pending.get(response.id);
        if (item) { pending.delete(response.id); response.error ? item.reject(new Error(response.error.message)) : item.resolve(response.result); }
      } catch (error) { fail(error); }
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next; pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  try {
    await call('initialize', { clientInfo: { name: 'tti-preflight', version: '1' }, capabilities: { experimentalApi: true } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const auth = await call('account/read', { refreshToken: false });
    const limits = await call('account/rateLimits/read');
    const models = await call('model/list', { includeHidden: false });
    const windows = Object.entries(limits.rateLimitsByLimitId ?? { codex: limits.rateLimits }).map(([id, value]) => ({
      id, primary: value.primary, secondary: value.secondary, spendControlReached: value.spendControlReached,
      rateLimitReachedType: value.rateLimitReachedType, hasCredits: value.credits?.hasCredits ?? null }));
    return { checkedAt: new Date().toISOString(), auth: auth.account?.type, plan: auth.account?.planType,
      ordinaryUsageAllowed: limits.ordinaryUsageAllowed ?? null, windows,
      availableModels: models.data.map(m => ({ id: m.id, model: m.model, efforts: m.supportedReasoningEfforts.map(e => e.reasoningEffort) })) };
  } finally { clearTimeout(timer); child.kill('SIGTERM'); child.stdin.destroy(); child.stdout.destroy(); }
}
export function requireAllowance(account) {
  if (account.auth !== 'chatgpt') throw new Error('Subscription login required for this client adapter');
  if (account.ordinaryUsageAllowed !== true) throw new Error('Included usage is unavailable or could not be confirmed');
  const general = account.windows.find(w => w.id === 'codex');
  const windows = [general?.primary, general?.secondary].filter(Boolean);
  if (!general || general.hasCredits !== false || !windows.length || general.spendControlReached || general.rateLimitReachedType
    || windows.some(w => !Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent >= 90)) {
    throw new Error('Subscription allowance is limited; no credit or API fallback');
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await codexAccount();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}
