import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const output = path.resolve('.test-output/body-limits');
await fs.mkdir(output, { recursive: true });
const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
const files = {
  'student-server': 'lib/student-server.ts',
  'student-auth': 'lib/student-auth.ts',
  'request-body': 'lib/request-body.ts',
  chat: 'app/api/chat/route.ts',
  progress: 'app/learn/[slug]/progress/route.ts',
};
for (const [name, file] of Object.entries(files)) {
  const source = await fs.readFile(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions }).outputText
    .replace(/from ['"]cloudflare:workers['"]/g, "from './environment.mjs'")
    .replace(/from ['"](?:\.\/|(?:\.\.\/)+lib\/)([^'"]+)['"]/g, (specifier, dependency) => {
      if (dependency.endsWith('.mjs')) return specifier;
      if (dependency === 'chat' || dependency === 'progress') return "from './stubs.mjs'";
      return Object.hasOwn(files, dependency) ? "from './" + dependency + ".mjs'" : "from './stubs.mjs'";
    });
  await fs.writeFile(path.join(output, name + '.mjs'), code);
}
await fs.writeFile(path.join(output, 'environment.mjs'), "export const env = { DB: {} };");
await fs.writeFile(path.join(output, 'stubs.mjs'), [
  'export class PaymentFailure extends Error {}',
  'export class ChatRefusal extends Error {}',
  'export const enrolmentFor = async () => null, recordActivity = async () => {};',
  'export const cleanMessages = (messages) => messages;',
  'export const AI_TIMEOUT_MS = 1, MAX_REPLY_TOKENS = 1, MODEL = "", cleanReply = () => "", systemPrompt = () => "";',
  'export const getCatalogue = async () => ({ settings: {} }), takeChatTurn = async () => "site", whatsappLink = () => "";',
  'export const loadClassroom = async () => ({ student: { id: "student" }, lessons: [{ id: "lesson" }], enrolled: true });',
  'export const canOpen = () => true, recordProgress = async () => {};',
].join('\n'));
const load = (name) => import(pathToFileURL(path.join(output, name + '.mjs')).href);
const { formInput } = await load('student-server');
const { POST: postChat } = await load('chat');
const { POST: postProgress } = await load('progress');

const origin = 'https://school.test';
function streamedRequest(route, type, chunks, length) {
  let read = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      const chunk = chunks[read++];
      if (chunk === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(chunk));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const headers = { origin, 'content-type': type };
  if (length !== undefined) headers['content-length'] = String(length);
  const request = new Request(origin + route, { method: 'POST', headers, body, duplex: 'half' });
  return { request, state: () => ({ read, cancelled }) };
}

test('Student and gateway forms stop reading oversized streamed payloads even with a small declared size', async () => {
  const body = streamedRequest('/payment/sslcommerz/ipn', 'application/x-www-form-urlencoded', [
    'tran_id=test&padding=',
    'x'.repeat(40_000),
    '&status=VALID',
  ], 16);
  await assert.rejects(formInput(body.request), { status: 413 });
  assert.deepEqual(body.state(), { read: 2, cancelled: true });
});

test('Student forms retain URL encoded and multipart values', async () => {
  const multipart = new FormData();
  multipart.set('name', 'Student');
  multipart.set('ignored', new File(['test'], 'test.txt'));
  for (const body of [multipart, new URLSearchParams({ name: 'Student' })]) {
    const field = await formInput(new Request(origin + '/account', { method: 'POST', body }));
    assert.equal(field('name'), 'Student');
    assert.equal(field('ignored'), '');
  }
});

test('Oversized chat JSON is rejected before a valid prefix can reach chat', async () => {
  const body = streamedRequest('/api/chat', 'application/json', [
    '{"messages":[{"role":"user","content":"Hello"}]}',
    ' '.repeat(40_000),
    ' ',
  ]);
  assert.equal((await postChat(body.request)).status, 413);
  assert.deepEqual(body.state(), { read: 2, cancelled: true });
});

test('Progress rejects oversized JSON and forms, and still accepts the normal player update', async () => {
  const route = '/learn/physics/progress';
  for (const [type, prefix] of [
    ['application/json', '{"lesson":0,"done":true}'],
    ['application/x-www-form-urlencoded', 'lesson=0&done=1&padding='],
  ]) {
    const body = streamedRequest(route, type, [prefix, ' '.repeat(5_000), ' ']);
    assert.equal((await postProgress(body.request)).status, 413);
    assert.deepEqual(body.state(), { read: 2, cancelled: true });
  }
  const normal = streamedRequest(route, 'application/json', ['{"lesson":0,"done":true}']);
  assert.equal((await postProgress(normal.request)).status, 204);
});

