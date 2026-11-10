import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = path.resolve('.test-output/payment-notification');
await fs.mkdir(output, { recursive: true });
const source = (await fs.readFile('lib/payment-callbacks.ts', 'utf8')).replace(/^import .*;\r?\n/gm, '');
const fixtures = `
  let failure;
  export const setFailure = (value) => { failure = value; };
  const settleOrder = async () => { if (failure) throw failure; };
  const formInput = async (request) => {
    if (request.headers.get('x-test-too-large')) throw { status: 413 };
    const form = await request.formData();
    return (key) => form.get(key) || '';
  };
  const studentDb = () => ({});
  const gatewayConfig = () => ({});
  const failureMessage = (error) => ({ status: error.status ?? 500 });
`;
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
await fs.writeFile(path.join(output, 'callbacks.mjs'), fixtures + compiled);
const { paymentNotification, setFailure } = await import(pathToFileURL(path.join(output, 'callbacks.mjs')).href);
const callback = (headers) => new Request('https://school.test/payment/sslcommerz/ipn', {
  method: 'POST', headers, body: new URLSearchParams({ status: 'VALID', tran_id: 'TX123', val_id: 'VAL123' }),
});

test('An IPN settlement outage returns a retryable failure rather than acknowledging payment processing', async () => {
  for (const failure of [new Error('Temporary database failure'), { status: 502 }]) {
    setFailure(failure);
    const response = await paymentNotification(callback());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '30');
    assert.doesNotMatch(await response.text(), /database failure/i);
  }
  setFailure(undefined);
  assert.equal((await paymentNotification(callback())).status, 200);
});

test('Invalid and oversized notifications receive distinct responses', async () => {
  setFailure({ status: 404 });
  assert.equal((await paymentNotification(callback())).status, 200);
  assert.equal((await paymentNotification(callback({ 'x-test-too-large': '1' }))).status, 413);
  setFailure(undefined);
});
