// Course purchases through SSLCommerz.
// Nothing the browser sends is trusted: the price comes from the published catalogue, and an
// order is only marked paid after SSLCommerz's validation API confirms the transaction, its
// amount and its currency. Runtime configuration is passed in so this stays testable.
import { normalizePhone, type Student } from './student-auth';
import { canBuy, renewedEndsAt } from './access';

export class PaymentFailure extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type GatewayConfig={storeId:string;storePassword:string;live:boolean};
export type Order={id:string;tranId:string;studentId:string;courseSlug:string;courseTitle:string;amountMinor:number;currency:string;email:string;phone:string;status:string;note:string|null;createdAt:string;paidAt:string|null};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;

export const MIN_PRICE_MINOR=1000; // SSLCommerz accepts BDT 10.00 to 500,000.00
export const MAX_PRICE_MINOR=50000000;
export const gatewayHost=(config:GatewayConfig)=>config.live?'https://securepay.sslcommerz.com':'https://sandbox.sslcommerz.com';
export const purchasable=(course:any)=>!!course&&course.checkout===true&&Number.isInteger(course.priceMinor)&&course.priceMinor>=MIN_PRICE_MINOR&&course.priceMinor<=MAX_PRICE_MINOR;
export const taka=(minor:number)=>'৳'+new Intl.NumberFormat('en-BD',{maximumFractionDigits:2}).format(minor/100);
const iso=(ms:number)=>new Date(ms).toISOString();
const dhakaDate=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms);

export function rowToOrder(r:any):Order {return {id:r.id,tranId:r.tran_id,studentId:r.student_id,courseSlug:r.course_slug,courseTitle:r.course_title,amountMinor:r.amount_minor,currency:r.currency,email:r.email,phone:r.phone,status:r.status,note:r.note,createdAt:r.created_at,paidAt:r.paid_at};}
export async function orderById(db:D1Database,id:string){const r=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();return r?rowToOrder(r):null;}
export async function orderByTranId(db:D1Database,tranId:string){const r=await db.prepare('SELECT * FROM orders WHERE tran_id=?').bind(tranId).first();return r?rowToOrder(r):null;}
export type Enrolment={course_slug:string;course_title:string;created_at:string;expires_at:string|null;active:boolean};
const withActive=(r:any,now:number):Enrolment=>({...r,active:!r.expires_at||Date.parse(r.expires_at)>now});
export async function enrolmentFor(db:D1Database,studentId:string,courseSlug:string,now=Date.now()){const r=await db.prepare('SELECT course_slug,course_title,created_at,expires_at FROM enrolments WHERE student_id=? AND course_slug=?').bind(studentId,courseSlug).first();return r?withActive(r,now):null;}
export async function isEnrolled(db:D1Database,studentId:string,courseSlug:string,now=Date.now()){return !!(await enrolmentFor(db,studentId,courseSlug,now))?.active;}
// False while the student already has access that isn't ending this week.
export async function mayBuy(db:D1Database,studentId:string,courseSlug:string,now=Date.now()){const e=await enrolmentFor(db,studentId,courseSlug,now);return canBuy(e&&{active:e.active,expiresAt:e.expires_at},now);}
export async function enrolmentsFor(db:D1Database,studentId:string,now=Date.now()){return (await db.prepare('SELECT course_slug,course_title,created_at,expires_at FROM enrolments WHERE student_id=? ORDER BY created_at DESC').bind(studentId).all()).results.map(r=>withActive(r,now));}

// Contact details SSLCommerz requires; taken from the form, falling back to the account.
export function checkoutContact(student:Student,form:{email?:string;phone?:string}){
  const email=String(form.email||student.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>100)throw new PaymentFailure('Enter an email address for your payment receipt.');
  const phone=normalizePhone(form.phone||student.phone||'');
  if(!phone)throw new PaymentFailure('Enter your Bangladeshi mobile number, like 01712345678.');
  return {email,phone};
}

export async function createOrder(db:D1Database,student:Student,course:any,contact:{email:string;phone:string},now=Date.now()):Promise<Order>{
  if(!purchasable(course))throw new PaymentFailure('This course is not available to buy online. Contact admissions to enrol.',409);
  if(!await mayBuy(db,student.id,course.id,now))throw new PaymentFailure('You are already enrolled in this course.',409);
  const id=crypto.randomUUID();
  const tranId=('SS'+now.toString(36)+crypto.randomUUID().replace(/-/g,'').slice(0,10)).toUpperCase();
  await db.prepare('INSERT INTO orders(id,tran_id,student_id,course_slug,course_title,amount_minor,currency,email,phone,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,tranId,student.id,course.id,String(course.title).slice(0,255),course.priceMinor,'BDT',contact.email,contact.phone,'pending',iso(now),iso(now)).run();
  return (await orderById(db,id))!;
}

// Opens an SSLCommerz checkout session and returns the hosted payment page to send the student to.
export async function startPayment(config:GatewayConfig,order:Order,student:Student,origin:string,fetcher:Fetcher=fetch){
  const params=new URLSearchParams({
    store_id:config.storeId,store_passwd:config.storePassword,total_amount:(order.amountMinor/100).toFixed(2),currency:order.currency,tran_id:order.tranId,
    success_url:origin+'/payment/sslcommerz/success',fail_url:origin+'/payment/sslcommerz/fail',cancel_url:origin+'/payment/sslcommerz/cancel',ipn_url:origin+'/payment/sslcommerz/ipn',
    cus_name:(student.name||'Shikkha Squared student').slice(0,50),cus_email:order.email,cus_phone:order.phone.replace(/^\+88/,''),cus_add1:'Dhaka',cus_city:'Dhaka',cus_postcode:'1000',cus_country:'Bangladesh',
    shipping_method:'NO',product_name:order.courseTitle.slice(0,255),product_category:'Education',product_profile:'non-physical-goods',emi_option:'0',value_a:order.id,
  });
  let data:any;
  try{const response=await fetcher(gatewayHost(config)+'/gwprocess/v4/api.php',{method:'POST',body:params,signal:AbortSignal.timeout(15000)});data=await response.json();}
  catch{throw new PaymentFailure('The payment service did not respond. Please try again.',502);}
  const page=typeof data?.GatewayPageURL==='string'?data.GatewayPageURL:'';
  let host='';try{host=new URL(page).hostname;}catch{}
  if(data?.status!=='SUCCESS'||!/(^|\.)sslcommerz\.com$/.test(host)||!page.startsWith('https://'))throw new PaymentFailure('The payment could not be started. Please try again.',502);
  return page;
}

async function validate(config:GatewayConfig,valId:string,fetcher:Fetcher){
  const url=gatewayHost(config)+'/validator/api/validationserverAPI.php?'+new URLSearchParams({val_id:valId,store_id:config.storeId,store_passwd:config.storePassword,format:'json'});
  try{return await (await fetcher(url,{signal:AbortSignal.timeout(15000)})).json() as any;}catch{throw new PaymentFailure('Payment confirmation is delayed. Refresh this page in a minute.',502);}
}

async function recordInAdminLedger(db:D1Database,order:Order,student:Student|null,details:{bankTranId:string;cardType:string},now:number){
  const data={title:(student?.name||order.email).slice(0,160),reference:order.tranId,email:order.email,course:order.courseTitle.slice(0,160),amountMinor:order.amountMinor,method:'sslcommerz',date:dhakaDate(now),note:`Online payment${details.cardType?' · '+details.cardType:''}${details.bankTranId?' · bank ref '+details.bankTranId:''}`.slice(0,2000),source:'gateway'};
  const id=crypto.randomUUID();
  await db.prepare('INSERT OR IGNORE INTO records(id,kind,title,status,data,unique_key,version,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').bind(id,'payment',data.title,'paid',JSON.stringify(data),'sslcommerz:'+order.tranId.toLowerCase(),iso(now),iso(now)).run();
  await db.prepare('INSERT INTO audit_events(id,entity_id,action,summary,actor,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,'online payment',data.title+' · '+order.courseTitle,'website-checkout',iso(now)).run();
}

// Confirms a payment with SSLCommerz and, if genuine, marks the order paid and enrols the student.
// Safe to call more than once (browser redirect, IPN and status checks can all arrive).
export async function settleOrder(db:D1Database,config:GatewayConfig,tranId:string,valId:string,fetcher:Fetcher=fetch,now=Date.now()):Promise<Order>{
  const order=await orderByTranId(db,tranId);
  if(!order)throw new PaymentFailure('We could not find this payment.',404);
  if(order.status==='paid')return order;
  if(!valId)throw new PaymentFailure('Payment confirmation is missing.',400);
  const v=await validate(config,valId,fetcher);
  const genuine=(v.status==='VALID'||v.status==='VALIDATED')&&v.tran_id===order.tranId&&v.currency===order.currency&&Math.round(Number(v.amount)*100)===order.amountMinor;
  if(!genuine){
    await db.prepare("UPDATE orders SET status='failed',note=?,updated_at=? WHERE id=? AND status='pending'").bind('Validation rejected: '+String(v.status||'unknown').slice(0,40),iso(now),order.id).run();
    throw new PaymentFailure('This payment could not be confirmed. If money was taken, contact us with your payment reference.',402);
  }
  const details={bankTranId:String(v.bank_tran_id||'').slice(0,100),cardType:String(v.card_type||'').slice(0,60)};
  if(String(v.risk_level)==='1'){
    await db.prepare("UPDATE orders SET status='review',val_id=?,bank_tran_id=?,card_type=?,note=?,updated_at=? WHERE id=? AND status IN ('pending','failed','cancelled')").bind(valId,details.bankTranId,details.cardType,('Held by SSLCommerz risk check: '+String(v.risk_title||'')).slice(0,200),iso(now),order.id).run();
    return (await orderById(db,order.id))!;
  }
  // A forged fail/cancel callback can't block a genuine payment, so paid wins over those states.
  const changed=await db.prepare("UPDATE orders SET status='paid',val_id=?,bank_tran_id=?,card_type=?,paid_at=?,updated_at=? WHERE id=? AND status IN ('pending','failed','cancelled','review') RETURNING id").bind(valId,details.bankTranId,details.cardType,iso(now),iso(now),order.id).first();
  if(changed){
    // A first purchase starts access. Buying again adds a month from when the current access ends (or from now
    // if it already has). Lifetime access stays lifetime, and an end date is never shortened.
    const course=await db.prepare("SELECT json_extract(data,'$.format') AS format FROM records WHERE kind='course' AND unique_key=?").bind(order.courseSlug).first<{format:string}>();
    const current=await db.prepare('SELECT expires_at FROM enrolments WHERE student_id=? AND course_slug=?').bind(order.studentId,order.courseSlug).first<{expires_at:string|null}>();
    await db.prepare(`INSERT INTO enrolments(id,student_id,course_slug,course_title,source,order_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(student_id,course_slug) DO UPDATE SET source=excluded.source,order_id=excluded.order_id,course_title=excluded.course_title,
      expires_at=CASE WHEN enrolments.expires_at IS NULL OR excluded.expires_at IS NULL THEN NULL ELSE max(enrolments.expires_at,excluded.expires_at) END`)
      .bind(crypto.randomUUID(),order.studentId,order.courseSlug,order.courseTitle,'payment',order.id,iso(now),renewedEndsAt(course?.format,current?.expires_at,now)).run();
    const student=await db.prepare('SELECT name FROM students WHERE id=?').bind(order.studentId).first<{name:string}>();
    await recordInAdminLedger(db,order,student?{name:student.name} as Student:null,details,now);
  }
  return (await orderById(db,order.id))!;
}

// Fail and cancel callbacks only close orders that are still waiting.
export async function closeOrder(db:D1Database,tranId:string,status:'failed'|'cancelled',now=Date.now()){
  await db.prepare('UPDATE orders SET status=?,updated_at=? WHERE tran_id=? AND status=?').bind(status,iso(now),tranId,'pending').run();
  return orderByTranId(db,tranId);
}

// When the student returns before SSLCommerz's notification arrives, ask SSLCommerz directly.
export async function refreshPendingOrder(db:D1Database,config:GatewayConfig,order:Order,fetcher:Fetcher=fetch,now=Date.now()){
  if(order.status!=='pending')return order;
  const url=gatewayHost(config)+'/validator/api/merchantTransIDvalidationAPI.php?'+new URLSearchParams({tran_id:order.tranId,store_id:config.storeId,store_passwd:config.storePassword,format:'json'});
  let data:any;try{data=await (await fetcher(url,{signal:AbortSignal.timeout(15000)})).json();}catch{return order;}
  const valid=(Array.isArray(data?.element)?data.element:[]).find((e:any)=>(e.status==='VALID'||e.status==='VALIDATED')&&e.tran_id===order.tranId&&e.val_id);
  return valid?settleOrder(db,config,order.tranId,String(valid.val_id),fetcher,now):order;
}
