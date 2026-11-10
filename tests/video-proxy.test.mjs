import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const output = path.resolve('.test-output/video-proxy');
await fs.mkdir(output, { recursive: true });
const compile = async (source, target) => {
  const code = ts.transpileModule(await fs.readFile(source, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  await fs.writeFile(path.join(output, target), code
    .replace(/from ['"]cloudflare:workers['"]/g, "from './environment.mjs'")
    .replace(/from ['"](?:\.\/|(?:\.\.\/)+lib\/)(classroom|lessons|payments|progress|student-server)['"]/g, "from './$1.mjs'"));
};
await Promise.all([
  compile('lib/lessons.ts', 'lessons.mjs'),
  compile('lib/classroom.ts', 'classroom.mjs'),
  compile('app/learn/[slug]/stream/[...path]/route.ts', 'route.mjs'),
  fs.writeFile(path.join(output, 'environment.mjs'), "export const env = { TENBYTE_REFERRER: 'private-test-referrer' };"),
  fs.writeFile(path.join(output, 'payments.mjs'), "export const enrolmentFor = async () => ({ active: true, expires_at: null });"),
  fs.writeFile(path.join(output, 'progress.mjs'), "export const progressFor = async () => new Map();"),
  fs.writeFile(path.join(output, 'student-server.mjs'), `
    let student = { id: 'student' };
    export const setStudent = (value) => { student = value; };
    export const currentStudent = async () => student;
    export const noteActivity = async () => {};
    export const studentDb = () => ({
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            status: 'published',
            data: JSON.stringify({ lessons: [{ resourceUrl: 'https://video.tenbytecdn.com/lesson/master.m3u8' }] }),
          }),
        }),
      }),
    });
  `),
]);
const { GET } = await import(pathToFileURL(path.join(output, 'route.mjs')).href);
const { setStudent } = await import(pathToFileURL(path.join(output, 'student-server.mjs')).href);
const videoRequest = () => new Request('https://school.test/learn/physics/stream/0/part.ts', {
  headers: { range: 'bytes=0-3' },
});

test('A paid video range is playable and cannot be reused from browser cache after sign-out', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => new Response('data', {
    status: 206,
    headers: { 'content-type': 'video/mp2t', 'content-range': 'bytes 0-3/100', 'accept-ranges': 'bytes' },
  }));
  const response = await GET(videoRequest());
  assert.equal(response.status, 206);
  assert.match(response.headers.get('cache-control'), /\bno-store\b/);
  assert.equal(response.headers.get('content-type'), 'video/mp2t');
  assert.equal(response.headers.get('content-range'), 'bytes 0-3/100');
  assert.equal(await response.text(), 'data');
  assert.equal(upstream.mock.calls[0].arguments[1].headers.get('range'), 'bytes=0-3');
  setStudent(null);
  try {
    assert.equal((await GET(videoRequest())).status, 401);
    assert.equal(upstream.mock.callCount(), 1);
  } finally {
    setStudent({ id: 'student' });
  }
});

test('A CDN redirect cannot forward the private video referrer to another origin', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.redirect('https://untrusted.test/part.ts'));
  const response = await GET(videoRequest());
  assert.equal(response.status, 502);
  assert.equal(upstream.mock.callCount(), 1);
  const options = upstream.mock.calls[0].arguments[1];
  assert.equal(options.redirect, 'manual');
  assert.equal(options.headers.get('referer'), 'private-test-referrer');
});

test('An upstream HTML response is not served from the school origin as a video segment', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<script>untrusted()</script>', {
    headers: { 'content-type': 'text/html' },
  }));
  const response = await GET(videoRequest());
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /<script>/);
});
