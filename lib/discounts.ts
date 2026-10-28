import { PaymentFailure } from './payments';
export { discountedPrice } from './payments';

// Discount codes at checkout. The admin creates them (Shikkha_Squared_Backend_Source/lib/discounts-admin.ts);
// the website checks a code against the course, its dates and its uses each time, and never trusts a price
// from the browser. A use is counted when the payment succeeds (see settleOrder).

export type Discount={code:string;percent:number;courseSlug:string|null;startsAt:string|null;endsAt:string|null;maxUses:number|null;uses:number;active:boolean};
export const normalizeCode=(input:unknown)=>String(input??'').trim().toUpperCase().replace(/\s+/g,'');
const valid=(code:string)=>/^[A-Z0-9-]{3,20}$/.test(code);

export async function findDiscount(db:D1Database,input:unknown,courseSlug:string,now=Date.now()):Promise<Discount>{
  const code=normalizeCode(input);
  const row=valid(code)?await db.prepare('SELECT * FROM discount_codes WHERE code=?').bind(code).first<any>():null;
  const at=new Date(now).toISOString();
  if(!row||!row.active)throw new PaymentFailure('That discount code isn’t valid. Check the spelling and try again.');
  if(row.course_slug&&row.course_slug!==courseSlug)throw new PaymentFailure('That discount code isn’t for this course.');
  if(row.starts_at&&at<row.starts_at)throw new PaymentFailure('That discount code isn’t active yet.');
  if(row.ends_at&&at>row.ends_at)throw new PaymentFailure('That discount code has expired.');
  if(row.max_uses!==null&&row.uses>=row.max_uses)throw new PaymentFailure('That discount code has been fully used.');
  return {code:row.code,percent:row.percent,courseSlug:row.course_slug,startsAt:row.starts_at,endsAt:row.ends_at,maxUses:row.max_uses,uses:row.uses,active:!!row.active};
}
