// Run a built Worker with the same local variables, database and uploads as Vite dev.
import './wrangler-env.mjs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const localVars = fileURLToPath(new URL('.dev.vars', root));
const args = [
  fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', root)), 'dev',
  '--config', fileURLToPath(new URL('dist/server/wrangler.json', root)),
  '--local', '--persist-to', process.env.SHIKKHA_DEV_STATE || fileURLToPath(new URL('../.shikkha-dev-state', root)),
  '--port', process.argv[2], '--ip', '127.0.0.1', '--inspector-port', '0',
  ...(existsSync(localVars) ? ['--env-file', localVars] : []),
  ...process.argv.slice(3),
];
const child = spawn(process.execPath, args, { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
