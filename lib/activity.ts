import { sha256 } from './student-auth';

// Account activity, for the admin's "possible account sharing" alerts: each sign-in and each lesson video
// a student starts. The network address is stored only as a one-way scrambled code (so staff can count
// different networks without seeing addresses), with Cloudflare's approximate city and country.

export const ACTIVITY_DAYS=90;
export type Place={ip:string;city:string;country:string;userAgent:string};

// A coarse device type from the browser's description, e.g. "iPhone" or "Windows".
export function deviceLabel(userAgent:string){
  const ua=userAgent.toLowerCase();
  return ua.includes('iphone')?'iPhone':ua.includes('ipad')?'iPad':ua.includes('android')?'Android':ua.includes('windows')?'Windows':ua.includes('mac os')||ua.includes('macintosh')?'Mac':ua.includes('cros')?'Chromebook':ua.includes('linux')?'Linux':ua?'Other':'';
}

export async function recordActivity(db:D1Database,studentId:string,kind:'sign-in'|'watch',place:Place,pepper:string,now=Date.now()){
  const network=(await sha256(pepper+':network:'+place.ip)).slice(0,16);
  const at=new Date(now).toISOString();
  await db.prepare('INSERT INTO account_activity(id,student_id,kind,network,city,country,device,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),studentId,kind,network,place.city.slice(0,80),place.country.slice(0,2).toUpperCase(),deviceLabel(place.userAgent),at).run();
  await db.prepare('DELETE FROM account_activity WHERE student_id=? AND created_at<?').bind(studentId,new Date(now-ACTIVITY_DAYS*24*60*60*1000).toISOString()).run();
}
