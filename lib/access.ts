// How long course access lasts (Terms of Use, section 3): crash courses for life, every other
// course for one calendar month from payment. An enrolment without an end date is lifetime access.
// The admin applies the same rule when staff give access (Shikkha_Squared_Backend_Source/lib/students-admin.ts).
export const LIFETIME_FORMATS=['crash'];
export const isLifetime=(format:unknown)=>LIFETIME_FORMATS.includes(String(format));
export const accessLabel=(format:unknown)=>isLifetime(format)?'Lifetime access':'1 month access';

export function addOneMonth(ms:number){
  const d=new Date(ms),day=d.getUTCDate();
  const next=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()));
  const lastDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  next.setUTCDate(Math.min(day,lastDay)); // 31 Jan -> 28/29 Feb
  return next.getTime();
}
export const accessEndsAt=(format:unknown,from:number)=>isLifetime(format)?null:new Date(addOneMonth(from)).toISOString();
export const accessDate=(value:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date(value));

// What a student's access to one course looks like right now.
export type Access={active:boolean;expiresAt:string|null};
export const accessSummary=(a:Access)=>a.active?(a.expiresAt?`Access until ${accessDate(a.expiresAt)}`:'Lifetime access'):`Access ended ${accessDate(a.expiresAt!)}`;

// Renewing: in the last week of a monthly course, a student can pay again, and the new month starts when the
// current one ends, so no days are lost. Lifetime access never needs renewing.
export const RENEW_WINDOW_DAYS=7;
const DAY_MS=24*60*60*1000;
// Calendar days in Bangladesh time (UTC+6, no daylight saving), so "today" and "tomorrow" match the student's clock.
const dhakaDay=(ms:number)=>Math.floor((ms+6*60*60*1000)/DAY_MS);
export const daysLeft=(a:Access,now=Date.now())=>a.active&&a.expiresAt?Math.max(0,dhakaDay(Date.parse(a.expiresAt))-dhakaDay(now)):null;
export const endingSoon=(a:Access|null,now=Date.now())=>{const d=a?daysLeft(a,now):null;return d!==null&&d<=RENEW_WINDOW_DAYS;};
// Whether a student can buy the course now: no access yet, access that has ended, or access ending this week.
export const canBuy=(a:Access|null,now=Date.now())=>!a||!a.active||endingSoon(a,now);
export const renewedEndsAt=(format:unknown,current:string|null|undefined,now:number)=>
  isLifetime(format)?null:new Date(addOneMonth(Math.max(now,current?Date.parse(current):0))).toISOString();
export const endingNotice=(a:Access,now=Date.now())=>{const d=daysLeft(a,now)!;return d<=1?`Your access ends ${d===0?'today':'tomorrow'} (${accessDate(a.expiresAt!)}).`:`Your access ends in ${d} days, on ${accessDate(a.expiresAt!)}.`;};
// When access ends, in a few words: "today", "tomorrow" or "in 3 days".
export const endsWhen=(a:Access,now=Date.now())=>{const d=daysLeft(a,now)!;return d===0?'today':d===1?'tomorrow':`in ${d} days`;};
