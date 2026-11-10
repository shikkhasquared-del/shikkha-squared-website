import { db } from './db';
import { accountActivity } from '../db/schema';
import { eq, lt, and, count } from 'drizzle-orm';
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

export async function recordActivity(studentId:string,kind:'sign-in'|'watch',place:Place,pepper:string,now=Date.now()){
  const network = (await sha256(pepper+':network:'+place.ip)).slice(0,16);
  const nowDate = new Date(now);

  await db.insert(accountActivity).values({
    id: crypto.randomUUID(),
    studentId,
    kind,
    network,
    city: place.city.slice(0,80),
    country: place.country.slice(0,2).toUpperCase(),
    device: deviceLabel(place.userAgent),
    createdAt: nowDate,
  });

  // Delete old activity records
  const cutoffDate = new Date(now - ACTIVITY_DAYS*24*60*60*1000);
  await db.delete(accountActivity).where(and(eq(accountActivity.studentId, studentId), lt(accountActivity.createdAt, cutoffDate)));
}
