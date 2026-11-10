import { cookies } from 'next/headers';
import { createSession, readCookie, sessionStudent, SESSION_COOKIE, SESSION_TTL_MS, type AuthFailure } from './student-auth';
import type { GoogleConfig } from './google-auth';
import { enrolmentFor, type GatewayConfig, type PaymentFailure } from './payments';
import { recordActivity } from './activity';
import { db } from './db';
import type { Access } from './access';

// Next.js server-side glue for student accounts: database, configuration and responses.
export const otpPepper = () => process.env.OTP_PEPPER || '';
export const clientIp = (request: Request) => request.headers.get('x-forwarded-for') || 'local';

export async function currentStudent(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  return sessionStudent(db, sessionCookie);
}

export function googleConfig(request: Request): GoogleConfig | null {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  const origin = process.env.PUBLIC_ORIGIN || new URL(request.url).origin;
  return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: origin + '/auth/google/callback' };
}

export function gatewayConfig(): GatewayConfig | null {
  if (!process.env.SSLCOMMERZ_STORE_ID || !process.env.SSLCOMMERZ_STORE_PASSWORD) return null;
  const live = process.env.SSLCOMMERZ_LIVE === 'true';
  // A sandbox confirmation must never grant access on a production Worker.
  if (!live && process.env.NODE_ENV !== 'development') return null;
  return { storeId: process.env.SSLCOMMERZ_STORE_ID, storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD, live };
}

export const siteOrigin = (request: Request) => process.env.PUBLIC_ORIGIN || new URL(request.url).origin;

export function redirectResponse(location: string, cookiesArr: string[] = []) {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const c of cookiesArr) headers.append('set-cookie', c);
  return new Response(null, { status: 303, headers });
}

// Where a request comes from (approximate city and country from headers).
export function requestPlace(request: Request) {
  const ip = clientIp(request);
  const cfCity = request.headers.get('x-vercel-ip-city') || '';
  const cfCountry = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || '';
  return { ip, city: String(cfCity || ''), country: String(cfCountry || ''), userAgent: request.headers.get('user-agent') || '' };
}

// Notes account activity for sharing alerts. Never blocks what the student is doing.
export async function noteActivity(request: Request, studentId: string, kind: 'sign-in' | 'watch') {
  try {
    await recordActivity(studentId, kind, requestPlace(request), otpPepper() || 'shikkha');
  } catch (e) {
    console.error('Could not record activity', e instanceof Error ? e.message : '');
  }
}

export async function signedIn(request: Request, studentId: string, next: string, extraCookies: string[] = [], now: number = Date.now()) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const token = await createSession(db, studentId, now, sessionCookie);
  await noteActivity(request, studentId, 'sign-in');
  return redirectResponse(next, [...extraCookies, cookie(request, SESSION_COOKIE, token, { maxAge: SESSION_TTL_MS / 1000 })]);
}

export async function formInput(request: Request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) {
    throw { message: 'Use the form on this page.', status: 415 } as AuthFailure;
  }
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 32 * 1024) {
    throw { message: 'Request is too large.', status: 413 } as AuthFailure;
  }
  const form = await request.formData();
  return (name: string) => { const value = form.get(name); return typeof value === 'string' ? value : ''; };
}

export const failureMessage = (e: unknown) => {
  const isAuthFailure = e && typeof e === 'object' && 'message' in e && 'status' in e;
  if (isAuthFailure) return { error: (e as AuthFailure).message, status: (e as AuthFailure).status };
  console.error('Student account error', e instanceof Error ? e.message : 'Unknown');
  return { error: 'Something went wrong. Please try again.', status: 500 };
};

// The signed-in visitor's access to a course, if they have ever had any. Never fails a page render.
export async function viewerAccess(request: Request, courseSlug: string): Promise<Access | null> {
  try {
    const student = await currentStudent(request);
    const row = student ? await enrolmentFor(student.id, courseSlug) : null;
    return row ? { active: row.active, expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null } : null;
  } catch {
    return null;
  }
}

// Cookie helper
function cookie(request: Request, name: string, value: string, options: { maxAge: number }) {
  const cookieOptions = [
    `${name}=${value}`,
    `Path=/`,
    `Max-Age=${options.maxAge}`,
    `SameSite=Lax`,
    `HttpOnly`,
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  return cookieOptions;
}