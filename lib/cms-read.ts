// CMS read for Vercel - uses HTTP to admin's public endpoint
const ADMIN_URL = process.env.CMS_ORIGIN || 'https://shikkha-admin.lazimjzx.workers.dev';

export async function readCMS(path: string) {
  if (path !== '/api/published' && !/^\/api\/published\/media\/[a-f0-9-]{36}$/.test(path)) {
    throw new Error('Unsupported CMS read.');
  }
  const origin = ADMIN_URL;
  return fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
}
