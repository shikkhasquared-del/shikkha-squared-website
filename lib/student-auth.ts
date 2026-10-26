// Student accounts: phone sign-in codes, Google identities and cookie sessions.
// Runtime configuration is passed in so this module stays testable outside the Worker.

export class AuthFailure extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type Student={id:string;name:string;phone:string|null;email:string|null;googleSub:string|null;createdAt:string};

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

export function rowToStudent(row:any):Student {return {id:row.id,name:row.name,phone:row.phone,email:row.email,googleSub:row.google_sub,createdAt:row.created_at};}

// Issues a new sign-in code after per-number cooldown and per-number/per-network limits.
export async function issueLoginCode(db:D1Database,phone:string,ip:string,pepper:string,now=Date.now()){
  if(!pepper)throw new AuthFailure('Phone sign-in is not configured.',503);
  await db.prepare('DELETE FROM login_codes WHERE created_at<?').bind(iso(now-24*60*60*1000)).run();
  const latest=await db.prepare('SELECT created_at FROM login_codes WHERE phone=? ORDER BY created_at DESC LIMIT 1').bind(phone).first<{created_at:string}>();
  if(latest&&Date.parse(latest.created_at)>now-CODE_COOLDOWN_MS)throw new AuthFailure('A code was just sent. Wait a minute before asking for another.',429);
  const perPhone=await db.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE phone=? AND created_at>?').bind(phone,iso(now-CODES_PER_PHONE_WINDOW_MS)).first<{n:number}>();
  if((perPhone?.n??0)>=CODES_PER_PHONE)throw new AuthFailure('Too many codes were requested for this number. Try again in 15 minutes.',429);
  const perIp=await db.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE ip=? AND created_at>?').bind(ip,iso(now-CODES_PER_IP_WINDOW_MS)).first<{n:number}>();
  if((perIp?.n??0)>=CODES_PER_IP)throw new AuthFailure('Too many sign-in attempts from this network. Try again later.',429);
  const code=generateCode();
  await db.prepare('INSERT INTO login_codes(id,phone,ip,code_hash,attempts,created_at,expires_at) VALUES(?,?,?,?,0,?,?)').bind(crypto.randomUUID(),phone,ip,await codeHash(pepper,phone,code),iso(now),iso(now+CODE_TTL_MS)).run();
  return code;
}

// Checks the newest unused code for the number. Every check counts as an attempt; a code works once.
export async function consumeLoginCode(db:D1Database,phone:string,code:string,pepper:string,now=Date.now()){
  if(!pepper)throw new AuthFailure('Phone sign-in is not configured.',503);
  if(!/^\d{6}$/.test(code))throw new AuthFailure('Enter the 6-digit code from the SMS.');
  const row=await db.prepare('SELECT id,code_hash,attempts,expires_at FROM login_codes WHERE phone=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1').bind(phone).first<{id:string;code_hash:string;attempts:number;expires_at:string}>();
  if(!row||Date.parse(row.expires_at)<=now)throw new AuthFailure('This code has expired. Request a new one.',410);
  const counted=await db.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE id=? AND attempts<? RETURNING attempts').bind(row.id,CODE_MAX_ATTEMPTS).first();
  if(!counted)throw new AuthFailure('Too many incorrect tries. Request a new code.',429);
  if(!sameText(await codeHash(pepper,phone,code),row.code_hash))throw new AuthFailure('That code is not correct. Check the SMS and try again.');
  const used=await db.prepare('UPDATE login_codes SET used_at=? WHERE id=? AND used_at IS NULL RETURNING id').bind(iso(now),row.id).first();
  if(!used)throw new AuthFailure('This code has already been used. Request a new one.',410);
}

export async function studentById(db:D1Database,id:string){const row=await db.prepare('SELECT * FROM students WHERE id=?').bind(id).first();return row?rowToStudent(row):null;}

async function createStudent(db:D1Database,fields:{phone?:string;email?:string|null;googleSub?:string;name?:string},now:number){
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO students(id,name,phone,email,google_sub,created_at,updated_at,last_login_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,(fields.name||'').slice(0,100),fields.phone??null,fields.email??null,fields.googleSub??null,iso(now),iso(now),iso(now)).run();
  return (await studentById(db,id))!;
}

// Signed out: find or create the account for this number. Signed in: attach the number to the current account.
export async function studentForPhone(db:D1Database,phone:string,current:Student|null,now=Date.now()){
  const owner=await db.prepare('SELECT * FROM students WHERE phone=?').bind(phone).first();
  if(current){
    if(owner&&owner.id!==current.id)throw new AuthFailure('This number already belongs to another account. Sign in with it instead.',409);
    await db.prepare('UPDATE students SET phone=?,updated_at=? WHERE id=?').bind(phone,iso(now),current.id).run();
    return (await studentById(db,current.id))!;
  }
  if(owner){await db.prepare('UPDATE students SET last_login_at=? WHERE id=?').bind(iso(now),owner.id).run();return rowToStudent(owner);}
  return createStudent(db,{phone},now);
}

// Google accounts are matched only by Google's stable subject ID, never by email, so an email
// address alone can't take over an existing account.
export async function studentForGoogle(db:D1Database,identity:{sub:string;email:string|null;name:string},current:Student|null,now=Date.now()){
  const owner=await db.prepare('SELECT * FROM students WHERE google_sub=?').bind(identity.sub).first();
  if(current){
    if(owner&&owner.id!==current.id)throw new AuthFailure('This Google account is already connected to another account.',409);
    await db.prepare('UPDATE students SET google_sub=?,email=?,name=CASE WHEN name=\'\' THEN ? ELSE name END,updated_at=? WHERE id=?').bind(identity.sub,identity.email,identity.name.slice(0,100),iso(now),current.id).run();
    return (await studentById(db,current.id))!;
  }
  if(owner){await db.prepare('UPDATE students SET email=?,last_login_at=? WHERE id=?').bind(identity.email,iso(now),owner.id).run();return rowToStudent({...owner,email:identity.email});}
  return createStudent(db,{googleSub:identity.sub,email:identity.email,name:identity.name},now);
}

export async function updateStudentName(db:D1Database,student:Student,name:unknown,now=Date.now()){
  const clean=String(name??'').replace(/\s+/g,' ').trim();
  if(!clean)throw new AuthFailure('Enter your name.');
  if(clean.length>100)throw new AuthFailure('Use a name of up to 100 characters.');
  await db.prepare('UPDATE students SET name=?,updated_at=? WHERE id=?').bind(clean,iso(now),student.id).run();
  return (await studentById(db,student.id))!;
}

// `replacing` is this browser's previous session, so signing in again on the same device doesn't use up a second slot.
export async function createSession(db:D1Database,studentId:string,now=Date.now(),replacing:string|null=null){
  await endSession(db,replacing);
  const token=randomToken();
  await db.prepare('INSERT INTO student_sessions(id,student_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha256(token),studentId,iso(now),iso(now+SESSION_TTL_MS)).run();
  await db.prepare('DELETE FROM student_sessions WHERE student_id=? AND id NOT IN (SELECT id FROM student_sessions WHERE student_id=? AND expires_at>? ORDER BY created_at DESC,rowid DESC LIMIT ?)').bind(studentId,studentId,iso(now),MAX_DEVICES).run();
  return token;
}
export async function sessionStudent(db:D1Database,token:string|null,now=Date.now()){
  if(!token||token.length>100)return null;
  const id=await sha256(token);
  const row=await db.prepare('SELECT s.*,x.expires_at AS session_expires FROM student_sessions x JOIN students s ON s.id=x.student_id WHERE x.id=?').bind(id).first<any>();
  if(!row)return null;
  if(Date.parse(row.session_expires)<=now){await db.prepare('DELETE FROM student_sessions WHERE id=?').bind(id).run();return null;}
  return rowToStudent(row);
}
export async function endSession(db:D1Database,token:string|null){if(token&&token.length<=100)await db.prepare('DELETE FROM student_sessions WHERE id=?').bind(await sha256(token)).run();}

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
