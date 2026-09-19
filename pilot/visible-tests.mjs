import { fileURLToPath } from 'node:url';
import { execute } from './sandbox.mjs';
import { dependencyPath } from './workspace.mjs';

export function visibleTests(workspace, port, timeoutMs = 30000, directory = 'test') {
  const hook = fileURLToPath(new URL('./test-port.cjs', import.meta.url));
  return execute(workspace, `${JSON.stringify(process.execPath)} --require ${JSON.stringify(hook)} --test --test-concurrency=1 --test-reporter=tap ${directory}/*.test.js`, {
    port, timeoutMs, read: [dependencyPath, hook], env: { PORT: String(port) },
  });
}
