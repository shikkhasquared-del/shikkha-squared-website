import { env } from 'cloudflare:workers';
import { AuthFailure, SESSION_COOKIE, SESSION_TTL_MS, cookie, createSession, readCookie, sessionStudent } from './student-auth';
import type { GoogleConfig } from './google-auth';
import { PaymentFailure, enrolmentFor, type GatewayConfig } from './payments';
import { recordActivity } from './activity';

// Worker-side glue for student accounts: bindings, configuration and responses.
export function studentDb(){if(!env.DB)throw new AuthFailure('Student accounts are unavailable right now.',503);return env.DB;}
export const otpPepper=()=>env.OTP_PEPPER||'';
export const clientIp=(request:Request)=>request.headers.get('cf-connecting-ip')||'local';
export async function currentStudent(request:Request){return sessionStudent(studentDb(),readCookie(request,SESSION_COOKIE));}
export function googleConfig(request:Request):GoogleConfig|null {
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return null;
  const origin=env.PUBLIC_ORIGIN||new URL(request.url).origin;
  return {clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,redirectUri:origin+'/auth/google/callback'};
}
export function gatewayConfig():GatewayConfig|null {
  if(!env.SSLCOMMERZ_STORE_ID||!env.SSLCOMMERZ_STORE_PASSWORD)return null;
  return {storeId:env.SSLCOMMERZ_STORE_ID,storePassword:env.SSLCOMMERZ_STORE_PASSWORD,live:env.SSLCOMMERZ_LIVE==='true'};
}
export const siteOrigin=(request:Request)=>env.PUBLIC_ORIGIN||new URL(request.url).origin;
export function redirect(location:string,cookies:string[]=[]){
  const headers=new Headers({location,'cache-control':'no-store'});
  for(const c of cookies)headers.append('set-cookie',c);
  return new Response(null,{status:303,headers});
}
// Where a request comes from, as Cloudflare reports it (approximate city and country).
export function requestPlace(request:Request){
  const cf=(request as any).cf||{};
  return {ip:clientIp(request),city:String(cf.city||''),country:String(cf.country||request.headers.get('cf-ipcountry')||''),userAgent:request.headers.get('user-agent')||''};
}
// Notes account activity for sharing alerts. Never blocks what the student is doing.
export async function noteActivity(request:Request,studentId:string,kind:'sign-in'|'watch'){
  try{await recordActivity(studentDb(),studentId,kind,requestPlace(request),otpPepper()||'shikkha');}catch(e){console.error('Could not record activity',e instanceof Error?e.message:'');}
}
export async function signedIn(request:Request,studentId:string,next:string,extraCookies:string[]=[]){
  const token=await createSession(studentDb(),studentId,Date.now(),readCookie(request,SESSION_COOKIE));
  await noteActivity(request,studentId,'sign-in');
  return redirect(next,[...extraCookies,cookie(request,SESSION_COOKIE,token,{maxAge:SESSION_TTL_MS/1000})]);
}
export async function formInput(request:Request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/x-www-form-urlencoded')&&!type.includes('multipart/form-data'))throw new AuthFailure('Use the form on this page.',415);
  const form=await request.formData();
  return (name:string)=>{const value=form.get(name);return typeof value==='string'?value:'';};
}
export const failureMessage=(e:unknown)=>e instanceof AuthFailure||e instanceof PaymentFailure?{error:e.message,status:e.status}:(console.error('Student account error',e instanceof Error?e.message:'Unknown'),{error:'Something went wrong. Please try again.',status:500});
// The signed-in visitor's access to a course, if they have ever had any. Never fails a page render.
export async function viewerAccess(request:Request,courseSlug:string){
  try{const student=await currentStudent(request);const row=student?await enrolmentFor(studentDb(),student.id,courseSlug):null;return row?{active:row.active,expiresAt:row.expires_at}:null;}catch{return null;}
}
