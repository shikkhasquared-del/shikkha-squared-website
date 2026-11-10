// Course purchases through SSLCommerz.
// Nothing the browser sends is trusted: the price comes from the published catalogue, and an
// order is only marked paid after SSLCommerz's validation API confirms the transaction, its
// amount and its currency. Runtime configuration is passed in so this stays testable.
import { db } from './db';
import { orders, enrolments, discountCodes, students, records, auditEvents } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { normalizePhone, type Student } from './student-auth';
import { canBuy, renewedEndsAt, LIFETIME_FORMATS, type Access } from './access';

export class PaymentFailure extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type GatewayConfig={storeId:string;storePassword:string;live:boolean};
export type Order={id:string;tranId:string;studentId:string;courseSlug:string;courseTitle:string;amountMinor:number;currency:string;email:string;phone:string;status:string;note:string|null;createdAt:string;paidAt:string|null;discountCode:string|null;listPriceMinor:number|null;valId:string|null;bankTranId:string|null;cardType:string|null};
export type CheckoutCourse={id:string;title:string;format?:string;board?:string;teacher?:string;checkout?:boolean;priceMinor?:number|null};
export type PurchasableCourse=CheckoutCourse&{checkout:true;priceMinor:number};
type OrderRow={id:string;tranId:string;studentId:string;courseSlug:string;courseTitle:string;amountMinor:number;currency:string;email:string;phone:string;status:string;note:string|null;createdAt:Date;paidAt:Date|null;discountCode?:string|null;listPriceMinor?:number|null;valId?:string|null;bankTranId?:string|null;cardType?:string|null};
type EnrolmentRow={id:string;studentId:string;courseSlug:string;courseTitle:string;source:string;orderId?:string|null;createdAt:Date;expiresAt?:Date|null};
type GatewaySession={status?:string;GatewayPageURL?:string};
type GatewayValidation={status?:string;tran_id?:string;currency?:string;amount?:string|number;bank_tran_id?:string;card_type?:string;risk_level?:string|number;risk_title?:string;val_id?:string};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;

export const MIN_PRICE_MINOR=1000; // SSLCommerz accepts BDT 10.00 to 500,000.00
export const MAX_PRICE_MINOR=50000000;
export const gatewayHost=(config:GatewayConfig)=>config.live?'https://securepay.sslcommerz.com':'https://sandbox.sslcommerz.com';
export const purchasable=<T extends Pick<CheckoutCourse,'checkout'|'priceMinor'>>(course:T|null|undefined):course is T&{checkout:true;priceMinor:number}=>!!course&&course.checkout===true&&typeof course.priceMinor==='number'&&Number.isInteger(course.priceMinor)&&course.priceMinor>=MIN_PRICE_MINOR&&course.priceMinor<=MAX_PRICE_MINOR;
export const taka=(minor:number)=>'৳'+new Intl.NumberFormat('en-BD',{maximumFractionDigits:2}).format(minor/100);
// A discounted fee, rounded to whole taka and never below what SSLCommerz accepts.
export const discountedPrice=(priceMinor:number,percent:number)=>Math.max(MIN_PRICE_MINOR,Math.round(priceMinor*(100-percent)/100/100)*100);
const iso=(ms:number)=>new Date(ms).toISOString();
const dhakaDate=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms);

export function rowToOrder(r:OrderRow):Order {return {id:r.id,tranId:r.tranId,studentId:r.studentId,courseSlug:r.courseSlug,courseTitle:r.courseTitle,amountMinor:r.amountMinor,currency:r.currency,email:r.email,phone:r.phone,status:r.status,note:r.note,createdAt:r.createdAt.toISOString(),paidAt:r.paidAt?.toISOString()||null,discountCode:r.discountCode??null,listPriceMinor:r.listPriceMinor??null,valId:r.valId??null,bankTranId:r.bankTranId??null,cardType:r.cardType??null};}

export async function orderById(id:string){
  const r = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return r[0] ? rowToOrder(r[0] as OrderRow) : null;
}

export async function orderByTranId(tranId:string){
  const r = await db.select().from(orders).where(eq(orders.tranId, tranId)).limit(1);
  return r[0] ? rowToOrder(r[0] as OrderRow) : null;
}

export type Enrolment={id?:string;studentId?:string;courseSlug:string;courseTitle:string;createdAt:Date;expiresAt?:Date|null;orderId?:string|null;source?:string;active:boolean};
const withActive=(r:EnrolmentRow,now:number):Enrolment=>({...r,active:!r.expiresAt||r.expiresAt.getTime()>now});

export async function enrolmentFor(studentId:string,courseSlug:string,now=Date.now()){
  const r = await db.select().from(enrolments)
    .where(and(eq(enrolments.studentId, studentId), eq(enrolments.courseSlug, courseSlug)))
    .limit(1);
  return r[0] ? withActive(r[0] as EnrolmentRow, now) : null;
}

export async function isEnrolled(studentId:string,courseSlug:string,now=Date.now()){
  return !!(await enrolmentFor(studentId,courseSlug,now))?.active;
}

// Convert Enrolment to Access for canBuy function
function enrolmentToAccess(e: Enrolment): Access {
  return {
    active: e.active,
    expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null
  };
}

// False while the student already has access that isn't ending this week.
export async function mayBuy(studentId:string,courseSlug:string,now=Date.now()){
  const e = await enrolmentFor(studentId,courseSlug,now);
  return canBuy(e ? enrolmentToAccess(e) : null, now);
}

export async function enrolmentsFor(studentId:string,now=Date.now()){
  const r = await db.select().from(enrolments)
    .where(eq(enrolments.studentId, studentId))
    .orderBy(enrolments.createdAt);
  return r.map(row => withActive(row as EnrolmentRow, now));
}

// Contact details SSLCommerz requires; taken from the form, falling back to the account.
export function checkoutContact(student:Student,form:{email?:string;phone?:string}){
  const email=String(form.email||student.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>100)throw new PaymentFailure('Enter an email address for your payment receipt.');
  const phone=normalizePhone(form.phone||student.phone||'');
  if(!phone)throw new PaymentFailure('Enter your Bangladeshi mobile number, like 01712345678.');
  return {email,phone};
}

// `discount` is a code already checked with findDiscount (lib/discounts.ts).
export async function createOrder(student:Student,course:CheckoutCourse,contact:{email:string;phone:string},now=Date.now(),discount:{code:string;percent:number}|null=null):Promise<Order>{
  if(!purchasable(course))throw new PaymentFailure('This course is not available to buy online. Contact admissions to enrol.',409);
  if(!await mayBuy(student.id,course.id,now))throw new PaymentFailure('You are already enrolled in this course.',409);
  const id=crypto.randomUUID();
  const tranId=('SS'+now.toString(36)+crypto.randomUUID().replace(/-/g,'').slice(0,10)).toUpperCase();
  const amount=discount?discountedPrice(course.priceMinor!,discount.percent):course.priceMinor!;

  await db.insert(orders).values({
    id,
    tranId,
    studentId: student.id,
    courseSlug: course.id,
    courseTitle: String(course.title).slice(0,255),
    amountMinor: amount,
    currency: 'BDT',
    email: contact.email,
    phone: contact.phone,
    status: 'pending',
    createdAt: new Date(now),
    updatedAt: new Date(now),
    discountCode: discount?.code ?? null,
    listPriceMinor: discount ? course.priceMinor! : null,
  });

  return (await orderById(id))!;
}

// Opens an SSLCommerz checkout session and returns the hosted payment page to send the student to.
export async function startPayment(config:GatewayConfig,order:Order,student:Student,origin:string,fetcher:Fetcher=fetch){
  const params=new URLSearchParams({
    store_id:config.storeId,store_passwd:config.storePassword,total_amount:(order.amountMinor/100).toFixed(2),currency:order.currency,tran_id:order.tranId,
    success_url:origin+'/payment/sslcommerz/success',fail_url:origin+'/payment/sslcommerz/fail',cancel_url:origin+'/payment/sslcommerz/cancel',ipn_url:origin+'/payment/sslcommerz/ipn',
    cus_name:(student.name||'Shikkha Squared student').slice(0,50),cus_email:order.email,cus_phone:order.phone.replace(/^\+88/,''),cus_add1:'Dhaka',cus_city:'Dhaka',cus_postcode:'1000',cus_country:'Bangladesh',
    shipping_method:'NO',product_name:order.courseTitle.slice(0,255),product_category:'Education',product_profile:'non-physical-goods',emi_option:'0',value_a:order.id,
  });
  let data:GatewaySession|null;
  try{const response=await fetcher(gatewayHost(config)+'/gwprocess/v4/api.php',{method:'POST',body:params,signal:AbortSignal.timeout(15000)});data=await response.json() as GatewaySession|null;}
  catch{throw new PaymentFailure('The payment service did not respond. Please try again.',502);}
  const page=typeof data?.GatewayPageURL==='string'?data.GatewayPageURL:'';
  let host='';try{host=new URL(page).hostname;}catch{}
  if(data?.status!=='SUCCESS'||!/(^|\.)sslcommerz\.com$/.test(host)||!page.startsWith('https://'))throw new PaymentFailure('The payment could not be started. Please try again.',502);
  return page;
}

async function validate(config:GatewayConfig,valId:string,fetcher:Fetcher){
  const url=gatewayHost(config)+'/validator/api/validationserverAPI.php?'+new URLSearchParams({val_id:valId,store_id:config.storeId,store_passwd:config.storePassword,format:'json'});
  try {
    const response = await fetcher(url, {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('SSLCommerz validation request failed');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('status' in data) || typeof data.status !== 'string' || !data.status.trim()) {
      throw new Error('Malformed SSLCommerz validation response');
    }
    return data as GatewayValidation;
  } catch {
    throw new PaymentFailure('Payment confirmation is delayed. Refresh this page in a minute.', 502);
  }
}

const unsettledOrderStatuses = ['pending', 'failed', 'cancelled', 'review'] as const;

// Evaluate a renewal against the enrolment inside the transaction, after any other payment.
// Clamp the day to the following month's last day (31 January -> 28/29 February), retaining
// the original UTC time and milliseconds, just like addOneMonth in access.ts.
function renewalExpiry(currentExpiresAt: Date | null, now: Date): Date | null {
  if (!currentExpiresAt) return null;
  const start = new Date(Math.max(currentExpiresAt.getTime(), now.getTime()));
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  nextMonth.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return nextMonth;
}

// Confirms a payment with SSLCommerz and, if genuine, marks the order paid and enrols the student.
// Safe to call more than once (browser redirect, IPN and status checks can all arrive).
export async function settleOrder(config:GatewayConfig,tranId:string,valId:string,fetcher:Fetcher=fetch,now=Date.now()):Promise<Order>{
  const order = await orderByTranId(tranId);
  if(!order)throw new PaymentFailure('We could not find this payment.',404);
  if(order.status==='paid')return order;
  if(!valId)throw new PaymentFailure('Payment confirmation is missing.',400);
  const v = await validate(config,valId,fetcher);
  const genuine = (v.status==='VALID'||v.status==='VALIDATED')&&v.tran_id===order.tranId&&v.currency===order.currency&&Math.round(Number(v.amount)*100)===order.amountMinor;
  if(!genuine){
    await db.update(orders).set({ status: 'failed', note: 'Validation rejected: '+String(v.status||'unknown').slice(0,40), updatedAt: new Date(now) }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
    throw new PaymentFailure('This payment could not be confirmed. If money was taken, contact us with your payment reference.',402);
  }
  const details = {bankTranId:String(v.bank_tran_id||'').slice(0,100),cardType:String(v.card_type||'').slice(0,60)};
  if(String(v.risk_level)==='1'){
    await db.update(orders).set({ status: 'review', valId, bankTranId: details.bankTranId, cardType: details.cardType, note: ('Held by SSLCommerz risk check: '+String(v.risk_title||'')).slice(0,200), updatedAt: new Date(now) }).where(and(eq(orders.id, order.id), inArray(orders.status, ['pending', 'failed', 'cancelled'])));
    return (await orderById(order.id))!;
  }

  // Get course format for renewal calculation
  const courseRecord = await db.select({ data: records.data }).from(records).where(and(eq(records.kind, 'course'), eq(records.uniqueKey, order.courseSlug))).limit(1);
  const courseFormat = courseRecord[0] ? JSON.parse(courseRecord[0].data).format : undefined;

  // Use a transaction to ensure atomicity
  await db.transaction(async (tx) => {
    const nowDate = new Date(now);
    const expiresAt = renewedEndsAt(courseFormat, null, now);

    // Insert or update enrolment
    await tx.insert(enrolments).values({
      id: crypto.randomUUID(),
      studentId: order.studentId,
      courseSlug: order.courseSlug,
      courseTitle: order.courseTitle,
      source: 'payment',
      orderId: order.id,
      createdAt: nowDate,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).onConflictDoUpdate({
      target: [enrolments.studentId, enrolments.courseSlug],
      set: {
        source: 'payment',
        orderId: order.id,
        courseTitle: order.courseTitle,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Update discount code usage if applicable
    if(order.discountCode){
      await tx.update(discountCodes)
        .set({ uses: sql`${discountCodes.uses} + 1`, updatedAt: nowDate })
        .where(eq(discountCodes.code, order.discountCode));
    }

    // Get student name for ledger
    const studentRecord = await tx.select({ name: students.name }).from(students).where(eq(students.id, order.studentId)).limit(1);

    // Create payment record in admin ledger
    const paymentId = crypto.randomUUID();
    const paymentKey = 'sslcommerz:'+order.tranId.toLowerCase();
    const paymentData = {
      title: (studentRecord[0]?.name || order.email).slice(0,160),
      reference: order.tranId,
      email: order.email,
      course: order.courseTitle.slice(0,160),
      amountMinor: order.amountMinor,
      method: 'sslcommerz',
      date: dhakaDate(now),
      note: `Online payment${order.discountCode?' · code '+order.discountCode:''}${details.cardType?' · '+details.cardType:''}${details.bankTranId?' · bank ref '+details.bankTranId:''}`.slice(0,2000),
      source: 'gateway',
    };

    await tx.insert(records).values({
      id: paymentId,
      kind: 'payment',
      title: paymentData.title,
      status: 'paid',
      data: JSON.stringify(paymentData),
      uniqueKey: paymentKey,
      version: 1,
      createdAt: nowDate,
      updatedAt: nowDate,
    });

    // Create audit event
    await tx.insert(auditEvents).values({
      id: crypto.randomUUID(),
      entityId: paymentId,
      action: 'online payment',
      summary: paymentData.title + ' · ' + order.courseTitle,
      actor: 'website-checkout',
      createdAt: nowDate,
    });

    // Update order to paid
    await tx.update(orders).set({
      status: 'paid',
      valId,
      bankTranId: details.bankTranId,
      cardType: details.cardType,
      paidAt: nowDate,
      updatedAt: nowDate,
    }).where(and(eq(orders.id, order.id), inArray(orders.status, ['pending', 'failed', 'cancelled', 'review'])));
  });

  return (await orderById(order.id))!;
}

// Fail and cancel callbacks only close orders that are still waiting.
export async function closeOrder(tranId:string,status:'failed'|'cancelled',now=Date.now()){
  await db.update(orders).set({ status, updatedAt: new Date(now) }).where(and(eq(orders.tranId, tranId), eq(orders.status, 'pending')));
  return orderByTranId(tranId);
}

// When the student returns before SSLCommerz's notification arrives, ask SSLCommerz directly.
export async function refreshPendingOrder(config:GatewayConfig,order:Order,fetcher:Fetcher=fetch,now=Date.now()){
  if(order.status!=='pending')return order;
  const url=gatewayHost(config)+'/validator/api/merchantTransIDvalidationAPI.php?'+new URLSearchParams({tran_id:order.tranId,store_id:config.storeId,store_passwd:config.storePassword,format:'json'});
  let data:{element?:GatewayValidation[]}|null;try{data=await (await fetcher(url,{signal:AbortSignal.timeout(15000)})).json() as {element?:GatewayValidation[]}|null;}catch{return order;}
  const valid=(Array.isArray(data?.element)?data.element:[]).find(e=>(e.status==='VALID'||e.status==='VALIDATED')&&e.tran_id===order.tranId&&e.val_id);
  return valid?settleOrder(config,order.tranId,String(valid.val_id),fetcher,now):order;
}