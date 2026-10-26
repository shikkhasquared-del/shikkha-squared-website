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
