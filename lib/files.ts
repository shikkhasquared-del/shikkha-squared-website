// Uploaded files (lesson worksheets and other PDFs) live in the private R2 bucket the admin uploads to.
// Every file served is one R2 read, which Cloudflare bills past 10 million a month; the owner never wants
// the card charged, so the site stops serving files for the rest of the month at a much lower cap.

import { db } from './db';
import { fileDownloads, records } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const DOWNLOADS_PER_MONTH = 3_000_000;
const MEDIA_URL = /^\/media\/([a-f0-9-]{36})$/;

// The uploaded file a lesson points at ("/media/<id>", as the admin's lesson editor sets it), if any.
export const lessonFileId = (resourceUrl: string) => resourceUrl.match(MEDIA_URL)?.[1] ?? null;

const month = (now: number) => new Date(now).toISOString().slice(0, 7);

// Counts one download and says whether it may go ahead.
export async function takeDownload(now = Date.now()) {
  const m = month(now);
  const existing = await db.select().from(fileDownloads).where(eq(fileDownloads.month, m)).limit(1);

  if (existing.length === 0) {
    await db.insert(fileDownloads).values({ month: m, count: 1 });
    return true;
  }

  if (existing[0].count >= DOWNLOADS_PER_MONTH) {
    return false;
  }

  await db.update(fileDownloads).set({ count: existing[0].count + 1 }).where(eq(fileDownloads.month, m));
  return true;
}

export type StoredFile = { key: string; mime: string; fileName: string; size: number; status: string };

export async function storedFile(id: string): Promise<StoredFile | null> {
  const row = await db.select({ status: records.status, data: records.data })
    .from(records)
    .where(and(eq(records.id, id), eq(records.kind, 'asset'), isNull(records.archivedAt)))
    .limit(1);

  if (!row[0]) return null;
  const d = JSON.parse(row[0].data);
  return { key: String(d.key), mime: String(d.mime), fileName: String(d.fileName || 'file'), size: Number(d.size) || 0, status: row[0].status };
}

// PDFs open in the browser's own viewer; other files download. Names are cleaned for the header.
export function fileHeaders(file: StoredFile) {
  const name = file.fileName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'file';
  const headers = new Headers({ 'content-type': file.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  if (file.mime === 'application/pdf') headers.set('content-disposition', `inline; filename="${name}"`);
  else if (!file.mime.startsWith('image/')) { headers.set('content-disposition', `attachment; filename="${name}"`); headers.set('content-security-policy', "default-src 'none'; sandbox"); }
  return headers;
}