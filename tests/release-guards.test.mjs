import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = path.resolve('.test-output/release-guards');
await fs.mkdir(output, { recursive: true });
const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };

await fs.writeFile(path.join(output, 'environment.mjs'), `
  export const env = {
    TEST_DEV: false,
    SMS_PROVIDER: 'console',
    SSLCOMMERZ_STORE_ID: 'test-store',
    SSLCOMMERZ_STORE_PASSWORD: 'test-only',
  };
  export class AuthFailure extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
  export class PaymentFailure extends AuthFailure {}
`);

for (const name of ['student-server', 'sms']) {
  const source = (await fs.readFile('lib/' + name + '.ts', 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replaceAll('import.meta.env.DEV', 'env.TEST_DEV')
    .replaceAll('import.meta.env.PROD', '!env.TEST_DEV');
  await fs.writeFile(path.join(output, name + '.mjs'),
    "import { env, AuthFailure, PaymentFailure } from './environment.mjs';\n" +
    ts.transpileModule(source, { compilerOptions }).outputText);
}

const { env } = await import(pathToFileURL(path.join(output, 'environment.mjs')).href);
const { gatewayConfig } = await import(pathToFileURL(path.join(output, 'student-server.mjs')).href);
const { sendLoginCode } = await import(pathToFileURL(path.join(output, 'sms.mjs')).href);

test('A production Worker cannot grant course access using a sandbox payment', () => {
  env.TEST_DEV = false;
  env.SSLCOMMERZ_LIVE = 'false';
  assert.equal(gatewayConfig(), null);
  env.SSLCOMMERZ_LIVE = 'true';
  assert.equal(gatewayConfig().live, true);
  env.TEST_DEV = true;
  env.SSLCOMMERZ_LIVE = 'false';
  assert.equal(gatewayConfig().live, false, 'local development retains sandbox checkout');
});

test('Console SMS cannot reveal sign-in codes in a production Worker', async (t) => {
  const log = t.mock.method(console, 'log', () => {});
  env.TEST_DEV = false;
  await assert.rejects(sendLoginCode('+8801700000000', '123456'), { status: 503 });
  assert.equal(log.mock.callCount(), 0);
  env.TEST_DEV = true;
  await sendLoginCode('+8801700000000', '123456');
  assert.equal(log.mock.callCount(), 1, 'local development can read its synthetic sign-in code');
});
