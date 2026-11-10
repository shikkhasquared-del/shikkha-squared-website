import { db } from './db';
import { discountCodes } from '../db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { PaymentFailure } from './payments';
export { discountedPrice } from './payments';

// Discount codes at checkout. The admin creates them (Shikkha_Squared_Backend_Source/lib/discounts-admin.ts);
// the website checks a code against the course, its dates and its uses each time, and never trusts a price
// from the browser. A use is counted when the payment succeeds (see settleOrder).

export type Discount={code:string;percent:number;courseSlug:string|null;startsAt:string|null;endsAt:string|null;maxUses:number|null;uses:number;active:boolean};
export const normalizeCode=(input:unknown)=>String(input??'').trim().toUpperCase().replace(/\s+/g,'');
const valid=(code:string)=>/^[A-Z0-9-]{3,20}$/.test(code);

export async function findDiscount(input:unknown,courseSlug:string,now=Date.now()):Promise<Discount>{
  const code=normalizeCode(input);
  if(!valid(code)) throw new PaymentFailure('That discount code isn’t valid. Check the spelling and try again.');

  const row = await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1);
  if(!row[0] || !row[0].active) throw new PaymentFailure('That discount code isn’t valid. Check the spelling and try again.');

  const discount = row[0];
  const at = new Date(now);

  if(discount.courseSlug && discount.courseSlug !== courseSlug) throw new PaymentFailure('That discount code isn’t for this course.');
  if(discount.startsAt && at < discount.startsAt) throw new PaymentFailure('That discount code isn’t active yet.');
  if(discount.endsAt && at > discount.endsAt) throw new PaymentFailure('That discount code has expired.');
  if(discount.maxUses !== null && discount.uses >= discount.maxUses) throw new PaymentFailure('That discount code has been fully used.');

  return {
    code: discount.code,
    percent: discount.percent,
    courseSlug: discount.courseSlug,
    startsAt: discount.startsAt?.toISOString() ?? null,
    endsAt: discount.endsAt?.toISOString() ?? null,
    maxUses: discount.maxUses,
    uses: discount.uses,
    active: discount.active,
  };
}
