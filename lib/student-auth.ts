// Student accounts: phone sign-in codes, Google identities and cookie sessions.
// Runtime configuration is passed in so this module stays testable outside the Worker.

import { students, studentSessions, loginCodes } from '../db/schema';
import type { SQL } from 'drizzle-orm';
import { eq, and, sql, inArray, lt, gt, count, isNull } from 'drizzle-orm';
import type { DB } from './db';

export class AuthFailure extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type Student={id:string;name:string;phone:string|null;email:string|null;googleSub:string|null;createdAt:string};
type StudentRow={id:string;name:string;phone:string|null;email:string|null;googleSub:string|null;createdAt:Date;updatedAt:Date;lastLoginAt:Date|null};

export const CODE_TTL_MS=5*60*1000;
export const CODE_MAX_ATTEMPTS=5;
export const CODE_COOLDOWN_MS=60*1000;
export const CODES_PER_PHONE=3, CODES_PER_PHONE_WINDOW_MS=15*60*1000;
export const CODES_PER_IP=10, CODES_PER_IP_WINDOW_MS=60*60*1000;
export const SESSION_TTL_MS=30*24*60*60*1000;
export const SESSION_COOKIE='ss_session';
// How many devices can be signed in to one account at once; signing in on another signs out the oldest.
export const MAX_DEVICES=2;

// Bangladeshi mobile numbers: 01[3-9] followed by 8 digits, with or without +88 / 88.
export function normalizePhone(input:unknown):string|null {
  const digits=String(input??'').replace(/[\s()-]/g,'').replace(/^\+/,'');
  if(!/^\d+$/.test(digits))return null;
  const local=digits.startsWith('880')?digits.slice(2):digits;
  return /^01[3-9]\d{8}$/.test(local)?'+88'+local:null;
}
export function displayPhone(phone:string){return phone.replace(/^\+880(\d{4})(\d{6})$/,'0$1-$2');}

// The name to greet a student by: the first word that isn't a title or an initial. Many Bangladeshi names
// start with one ("Md. Rafiqul Islam", "Mst. Nusrat Jahan", "A.K.M. Fazlul Haque", "মোঃ রফিকুল ইসলাম").
const TITLE=/^(md|mohd|mst|mt|mr|mrs|ms|dr|prof|engr|sk|মোঃ|মো|মোছাঃ|মোসাঃ|ডাঃ|ডঃ)[.:ঃ]*$/i;
const INITIALS=/^(\p{L}\.)+\p{L}?\.?$/u;
export function firstName(name:string){
  const words=name.trim().split(/\s+/).filter(Boolean);
  const word=words.find(w=>!TITLE.test(w)&&!INITIALS.test(w))??words[0]??'';
  return word.replace(/[.,:;]+$/,'');
}

// Same-origin relative destination after sign-in; anything else falls back to the account page.
export function safeNext(value:unknown,fallback='/account'):string {
  const text=String(value??'');
  if(!text.startsWith('/')||text.startsWith('//')||text.includes('\\'))return fallback;
  try{const url=new URL(text,'https://site.local');return url.origin==='https://site.local'?url.pathname+url.search:fallback;}catch{return fallback;}
}

export function base64url(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function randomToken(size=32){return base64url(crypto.getRandomValues(new Uint8Array(size)));}
export async function sha256(text:string){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));}
function sameText(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function generateCode(){const limit=4294000000;const n=new Uint32Array(1);do crypto.getRandomValues(n);while(n[0]>=limit);return String(n[0]%1000000).padStart(6,'0');}
const codeHash=(pepper:string,phone:string,code:string)=>sha256(pepper+':'+phone+':'+code);
const iso=(ms:number)=>new Date(ms).toISOString();

export function rowToStudent(row:StudentRow):Student {return {id:row.id,name:row.name,phone:row.phone,email:row.email,googleSub:row.googleSub,createdAt:row.createdAt.toISOString()};}

// Issues a new sign-in code after per-number cooldown and per-number/per-network limits.
export async function issueLoginCode(db:DB, phone:string,ip:string,pepper:string,now=Date.now()){
  if(!pepper)throw new AuthFailure('Phone sign-in is not configured.',503);

  const nowDate = new Date(now);
  const dayAgo = new Date(now - 24*60*60*1000);
  const cooldownWindow = new Date(now - CODE_COOLDOWN_MS);
  const phoneWindow = new Date(now - CODES_PER_PHONE_WINDOW_MS);
  const ipWindow = new Date(now - CODES_PER_IP_WINDOW_MS);

  // Delete old codes
  await db.delete(loginCodes).where(lt(loginCodes.createdAt, dayAgo));

  // Check quotas
  const [phoneCount] = await db.select({ count: count() }).from(loginCodes).where(and(eq(loginCodes.phone, phone), gt(loginCodes.createdAt, phoneWindow)));
  const [ipCount] = await db.select({ count: count() }).from(loginCodes).where(and(eq(loginCodes.ip, ip), gt(loginCodes.createdAt, ipWindow)));
  const [coolingDown] = await db.select({ count: count() }).from(loginCodes).where(and(eq(loginCodes.phone, phone), gt(loginCodes.createdAt, cooldownWindow)));

  if (coolingDown.count > 0) throw new AuthFailure('A code was just sent. Wait a minute before asking for another.', 429);
  if (phoneCount.count >= CODES_PER_PHONE) throw new AuthFailure('Too many codes were requested for this number. Try again in 15 minutes.', 429);
  if (ipCount.count >= CODES_PER_IP) throw new AuthFailure('Too many sign-in attempts from this network. Try again later.', 429);

  const code = generateCode();
  const hash = await codeHash(pepper, phone, code);

  await db.insert(loginCodes).values({
    id: crypto.randomUUID(),
    phone,
    ip,
    codeHash: hash,
    attempts: 0,
    createdAt: nowDate,
    expiresAt: new Date(now + CODE_TTL_MS),
  });

  return code;
}

type LoginCodeRow={id:string;codeHash:string;attempts:number;createdAt:Date;expiresAt:Date;usedAt:Date|null};

// Only the newest issued code can be checked. A match spends its attempt and consumes it together.
export async function consumeLoginCode(db:DB, phone:string,code:string,pepper:string,now=Date.now()){
  if(!pepper)throw new AuthFailure('Phone sign-in is not configured.',503);
  if(!/^\d{6}$/.test(code))throw new AuthFailure('Enter the 6-digit code from the SMS.');

  const at = new Date(now);
  const hash = await codeHash(pepper,phone,code);

  const rows = await db.select().from(loginCodes)
    .where(eq(loginCodes.phone, phone))
    .orderBy(loginCodes.createdAt, loginCodes.id)
    .limit(1);

  const row = rows[0] as LoginCodeRow;
  if(!row) throw new AuthFailure('No code was sent to this number. Request a new one.', 410);
  if(row.expiresAt <= at) throw new AuthFailure('This code has expired. Request a new one.', 410);
  if(row.usedAt !== null) throw new AuthFailure('This code has already been used. Request a new one.', 410);
  if(row.attempts >= CODE_MAX_ATTEMPTS) throw new AuthFailure('Too many incorrect tries. Request a new code.', 429);

  const matches = sameText(hash, row.codeHash);

  await db.update(loginCodes)
    .set({ attempts: row.attempts + 1, usedAt: matches ? at : null })
    .where(and(eq(loginCodes.id, row.id), eq(loginCodes.phone, phone), isNull(loginCodes.usedAt), gt(loginCodes.createdAt, at), sql`${loginCodes.attempts} < ${CODE_MAX_ATTEMPTS}`));

  if(!matches) throw new AuthFailure('That code is not correct. Check the SMS and try again.');
}

export async function studentById(db:DB, id:string){
  const row = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return row[0] ? rowToStudent(row[0] as StudentRow) : null;
}

async function createStudent(db:DB, fields:{phone?:string;email?:string|null;googleSub?:string;name?:string},now:number){
  const id = crypto.randomUUID();
  const nowDate = new Date(now);
  await db.insert(students).values({
    id,
    name: (fields.name||'').slice(0,100),
    phone: fields.phone ?? null,
    email: fields.email ?? null,
    googleSub: fields.googleSub ?? null,
    createdAt: nowDate,
    updatedAt: nowDate,
    lastLoginAt: nowDate,
  });
  return (await studentById(db, id))!;
}

// Signed out: find or create the account for this number. Signed in: attach the number to the current account.
export async function studentForPhone(db:DB, phone:string,current:Student|null,now=Date.now()){
  const nowDate = new Date(now);
  const owner = await db.select().from(students).where(eq(students.phone, phone)).limit(1);

  if(current){
    if(owner[0] && owner[0].id !== current.id) throw new AuthFailure('This number already belongs to another account. Sign in with it instead.', 409);
    await db.update(students).set({ phone, updatedAt: nowDate }).where(eq(students.id, current.id));
    return (await studentById(db, current.id))!;
  }
  if(owner[0]){
    await db.update(students).set({ lastLoginAt: nowDate }).where(eq(students.id, owner[0].id));
    return rowToStudent(owner[0] as StudentRow);
  }
  return createStudent(db, {phone}, now);
}

// Google accounts are matched only by Google's stable subject ID, never by email, so an email
// address alone can't take over an existing account.
export async function studentForGoogle(db:DB, identity:{sub:string;email:string|null;name:string},current:Student|null,now=Date.now()){
  const nowDate = new Date(now);
  const owner = await db.select().from(students).where(eq(students.googleSub, identity.sub)).limit(1);

  if(current){
    if(owner[0] && owner[0].id !== current.id) throw new AuthFailure('This Google account is already connected to another account.', 409);
    await db.update(students).set({
      googleSub: identity.sub,
      email: identity.email,
      name: current.name === '' ? identity.name.slice(0,100) : current.name,
      updatedAt: nowDate,
    }).where(eq(students.id, current.id));
    return (await studentById(db, current.id))!;
  }
  if(owner[0]){
    await db.update(students).set({ email: identity.email, lastLoginAt: nowDate }).where(eq(students.id, owner[0].id));
    return rowToStudent({...owner[0], email: identity.email} as StudentRow);
  }
  return createStudent(db, {googleSub: identity.sub, email: identity.email, name: identity.name}, now);
}

export async function updateStudentName(db:DB, student:Student,name:unknown,now=Date.now()){
  const clean=String(name??'').replace(/\s+/g,' ').trim();
  if(!clean)throw new AuthFailure('Enter your name.');
  if(clean.length>100)throw new AuthFailure('Use a name of up to 100 characters.');
  const nowDate = new Date(now);
  await db.update(students).set({ name: clean, updatedAt: nowDate }).where(eq(students.id, student.id));
  return (await studentById(db, student.id))!;
}

// `replacing` is this browser's previous session, so signing in again on the same device doesn't use up a second slot.
export async function createSession(db:DB, studentId:string,now=Date.now(),replacing:string|null=null){
  await endSession(db, replacing);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const nowDate = new Date(now);
  const expiresAt = new Date(now + SESSION_TTL_MS);

  await db.insert(studentSessions).values({
    id: tokenHash,
    studentId,
    createdAt: nowDate,
    expiresAt,
  });

  // Delete old sessions beyond MAX_DEVICES
  const sessions = await db.select({ id: studentSessions.id }).from(studentSessions)
    .where(and(eq(studentSessions.studentId, studentId), gt(studentSessions.expiresAt, nowDate)))
    .orderBy(studentSessions.createdAt, studentSessions.id)
    .limit(MAX_DEVICES);

  if (sessions.length > MAX_DEVICES) {
    const idsToDelete = sessions.slice(MAX_DEVICES).map(s => s.id);
    if (idsToDelete.length > 0) {
      await db.delete(studentSessions).where(inArray(studentSessions.id, idsToDelete));
    }
  }

  return token;
}

export async function sessionStudent(db:DB, token:string|null,now=Date.now()){
  if(!token||token.length>100)return null;
  const id = await sha256(token);
  const row = await db.select({
    id: students.id,
    name: students.name,
    phone: students.phone,
    email: students.email,
    googleSub: students.googleSub,
    createdAt: students.createdAt,
    sessionExpires: studentSessions.expiresAt,
  }).from(studentSessions)
  .innerJoin(students, eq(students.id, studentSessions.studentId))
  .where(eq(studentSessions.id, id))
  .limit(1);

  if(!row[0]) return null;
  if(row[0].sessionExpires.getTime() <= now){
    await db.delete(studentSessions).where(eq(studentSessions.id, id));
    return null;
  }
  return {
    id: row[0].id,
    name: row[0].name,
    phone: row[0].phone,
    email: row[0].email,
    googleSub: row[0].googleSub,
    createdAt: row[0].createdAt.toISOString(),
  };
}

export async function endSession(db:DB, token:string|null){
  if(token&&token.length<=100){
    const id = await sha256(token);
    await db.delete(studentSessions).where(eq(studentSessions.id, id));
  }
}

export function readCookie(request:Request,name:string){
  for(const part of (request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim();}
  return null;
}
export function cookie(request:Request,name:string,value:string,{maxAge,path='/'}:{maxAge:number;path?:string}){
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

// Form posts must come from this site (blocks cross-site sign-in and sign-out forgery).
export function isSameOrigin(request:Request){
  const origin=request.headers.get('origin');
  return request.headers.get('sec-fetch-site')!=='cross-site'&&(!origin||origin===new URL(request.url).origin);
}