import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const output=path.resolve('.test-output/payments'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
for(const name of ['student-auth','payments','access','discounts']){
  const source=await fs.readFile('lib/'+name+'.ts','utf8');
  await fs.writeFile(output+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from './student-auth'","from './student-auth.mjs'").replace("from './access'","from './access.mjs'").replaceAll("from './payments'","from './payments.mjs'"));
}
const pay=await import(outputUrl+'/payments.mjs');
const disc=await import(outputUrl+'/discounts.mjs');
const sql=(await Promise.all((await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile('drizzle/'+f,'utf8')))).join('\n');
// The admin's ledger tables live in the same database in production.
const adminTables=`CREATE TABLE records(id text PRIMARY KEY,kind text NOT NULL,title text NOT NULL,status text NOT NULL,data text NOT NULL,unique_key text,version integer NOT NULL DEFAULT 1,created_at text NOT NULL,updated_at text NOT NULL,archived_at text);
CREATE UNIQUE INDEX record_unique_key ON records(kind,unique_key);
CREATE TABLE audit_events(id text PRIMARY KEY,entity_id text NOT NULL,action text NOT NULL,summary text NOT NULL,actor text NOT NULL,created_at text NOT NULL);`;
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);sqlite.exec(adminTables);
  const db={prepare(query){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sqlite.prepare(query).get(...args)||null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){return sqlite.prepare(query).run(...args);}};return statement;}};
  return {db,sqlite};
}
const config={storeId:'testbox',storePassword:'qwerty',live:false};
const course={id:'physics-as',title:'Physics AS',board:'Cambridge',teacher:'Bappi Sir',priceMinor:449900,checkout:true};
const t0=Date.parse('2026-10-19T10:00:00Z');
function setup(){
  const {db,sqlite}=database();
  sqlite.prepare("INSERT INTO students(id,name,phone,email,created_at,updated_at) VALUES('stu-1','Rafi Ahmed','+8801712345678',NULL,'x','x')").run();
  return {db,sqlite,student:{id:'stu-1',name:'Rafi Ahmed',phone:'+8801712345678',email:null,googleSub:null,createdAt:'x'}};
}
// A stand-in for SSLCommerz: records calls and answers like the documented API.
function gateway(validation={}){
  const calls=[];
  const fetcher=async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/gwprocess/v4/api.php'))return Response.json({status:'SUCCESS',sessionkey:'S1',GatewayPageURL:'https://sandbox.sslcommerz.com/EasyCheckOut/testcde'});
    if(url.includes('validationserverAPI.php'))return Response.json({status:'VALID',tran_id:calls.tran,val_id:'VAL1',amount:'4499.00',currency:'BDT',bank_tran_id:'BANK1',card_type:'BKASH-BKash',risk_level:'0',...validation});
    if(url.includes('merchantTransIDvalidationAPI.php'))return Response.json({APIConnect:'DONE',no_of_trans_found:1,element:[{status:'VALID',tran_id:calls.tran,val_id:'VAL1',amount:'4499.00',currency:'BDT'}]});
    throw new Error('unexpected '+url);
  };
  return {calls,fetcher};
}
const failsWith=(promise,status)=>assert.rejects(promise,e=>e instanceof pay.PaymentFailure&&e.status===status);

test('Only courses switched on for online sale, with a fee SSLCommerz accepts, can be bought',()=>{
  assert.equal(pay.purchasable(course),true);
  for(const c of [{...course,checkout:false},{...course,priceMinor:null},{...course,priceMinor:999},{...course,priceMinor:12.5},{...course,priceMinor:50000001},undefined])assert.equal(pay.purchasable(c),false);
});

test('Checkout needs an email and a Bangladeshi mobile number',()=>{
  const student={id:'s',name:'',phone:'+8801712345678',email:null};
  assert.deepEqual(pay.checkoutContact(student,{email:' Rafi@Example.com '}),{email:'rafi@example.com',phone:'+8801712345678'});
  assert.throws(()=>pay.checkoutContact(student,{}),pay.PaymentFailure);
  assert.throws(()=>pay.checkoutContact({...student,phone:null},{email:'a@b.co',phone:'12345'}),pay.PaymentFailure);
});

test('Orders take the catalogue price and the payment page receives exactly that amount',async()=>{
  const {db,student}=setup();
  await failsWith(pay.createOrder(db,student,{...course,checkout:false},{email:'a@b.co',phone:'+8801712345678'}),409);
  const order=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  assert.equal(order.status,'pending');assert.equal(order.amountMinor,449900);assert.ok(order.tranId.length<=30);
  const {calls,fetcher}=gateway();
  assert.equal(await pay.startPayment(config,order,student,'https://site.test',fetcher),'https://sandbox.sslcommerz.com/EasyCheckOut/testcde');
  const sent=calls[0].init.body;
  assert.equal(calls[0].url,'https://sandbox.sslcommerz.com/gwprocess/v4/api.php');
  assert.equal(sent.get('total_amount'),'4499.00');assert.equal(sent.get('tran_id'),order.tranId);assert.equal(sent.get('currency'),'BDT');
  assert.equal(sent.get('success_url'),'https://site.test/payment/sslcommerz/success');assert.equal(sent.get('ipn_url'),'https://site.test/payment/sslcommerz/ipn');
  assert.equal(sent.get('cus_phone'),'01712345678');
  const bad=async body=>failsWith(pay.startPayment(config,order,student,'https://site.test',async()=>Response.json(body)),502);
  await bad({status:'FAILED',failedreason:'Store Credential Error'});
  await bad({status:'SUCCESS',GatewayPageURL:'https://evil.test/pay'});
  await bad({status:'SUCCESS',GatewayPageURL:'http://sandbox.sslcommerz.com/pay'});
  assert.equal(pay.gatewayHost({...config,live:true}),'https://securepay.sslcommerz.com');
});

test('A confirmed payment enrols the student once and is recorded in the admin ledger',async()=>{
  const {db,sqlite,student}=setup();
  const order=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  const {calls,fetcher}=gateway();calls.tran=order.tranId;
  const paid=await pay.settleOrder(db,config,order.tranId,'VAL1',fetcher,t0+5000);
  assert.equal(paid.status,'paid');
  assert.ok(calls.some(c=>c.url.includes('val_id=VAL1')&&c.url.includes('store_id=testbox')));
  assert.equal(await pay.isEnrolled(db,student.id,'physics-as'),true);
  await pay.settleOrder(db,config,order.tranId,'VAL1',fetcher,t0+6000);
  assert.equal(calls.filter(c=>c.url.includes('validationserverAPI')).length,1,'already-paid orders are not re-validated');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM enrolments').get().n,1);
  const ledger=sqlite.prepare("SELECT * FROM records WHERE kind='payment'").all();
  assert.equal(ledger.length,1);assert.equal(ledger[0].status,'paid');assert.equal(ledger[0].unique_key,'sslcommerz:'+order.tranId.toLowerCase());
  const data=JSON.parse(ledger[0].data);
  assert.deepEqual([data.amountMinor,data.method,data.source,data.reference,data.title],[449900,'sslcommerz','gateway',order.tranId,'Rafi Ahmed']);
  assert.deepEqual((await pay.enrolmentsFor(db,student.id)).map(e=>e.course_title),['Physics AS']);
  await failsWith(pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'}),409);
});

test('Payments that SSLCommerz does not confirm in full never grant access',async()=>{
  for(const validation of [{status:'INVALID_TRANSACTION'},{amount:'10.00'},{currency:'USD'},{tran_id:'SOMEONE-ELSE'}]){
    const {db,student}=setup();
    const order=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
    const {calls,fetcher}=gateway(validation);calls.tran=order.tranId;
    await failsWith(pay.settleOrder(db,config,order.tranId,'VAL1',fetcher,t0),402);
    assert.equal((await pay.orderById(db,order.id)).status,'failed');
    assert.equal(await pay.isEnrolled(db,student.id,'physics-as'),false,JSON.stringify(validation));
  }
  const {db}=setup();
  await failsWith(pay.settleOrder(db,config,'UNKNOWN','VAL1',gateway().fetcher),404);
});

test('Risky payments are held for review; forged cancels cannot block or undo a real payment',async()=>{
  const {db,student}=setup();
  const risky=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  const r=gateway({risk_level:'1',risk_title:'Possible fraud'});r.calls.tran=risky.tranId;
  assert.equal((await pay.settleOrder(db,config,risky.tranId,'VAL1',r.fetcher,t0)).status,'review');
  assert.equal(await pay.isEnrolled(db,student.id,'physics-as'),false);

  const {db:db2,student:s2}=setup();
  const order=await pay.createOrder(db2,s2,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  assert.equal((await pay.closeOrder(db2,order.tranId,'cancelled')).status,'cancelled');
  const g=gateway();g.calls.tran=order.tranId;
  assert.equal((await pay.settleOrder(db2,config,order.tranId,'VAL1',g.fetcher,t0)).status,'paid');
  assert.equal((await pay.closeOrder(db2,order.tranId,'failed')).status,'paid');
});

test('A student returning before the notification arrives is confirmed by looking the payment up',async()=>{
  const {db,student}=setup();
  const order=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  const {calls,fetcher}=gateway();calls.tran=order.tranId;
  const refreshed=await pay.refreshPendingOrder(db,config,order,fetcher,t0);
  assert.equal(refreshed.status,'paid');
  assert.ok(calls[0].url.includes('merchantTransIDvalidationAPI.php')&&calls[0].url.includes('tran_id='+order.tranId));
  const quiet=await pay.refreshPendingOrder(db,config,{...order,status:'pending',tranId:'NONE'},async()=>Response.json({APIConnect:'DONE',no_of_trans_found:0}),t0);
  assert.equal(quiet.status,'pending');
});

const access=await import(outputUrl+'/access.mjs');
const addCourseRecord=(sqlite,slug,format)=>sqlite.prepare("INSERT INTO records(id,kind,title,status,data,unique_key,version,created_at,updated_at) VALUES(?,?,?,?,?,?,1,'x','x')").run('rec-'+slug,'course',slug,'published',JSON.stringify({slug,format}),slug);

test('Access lasts one calendar month, or for life for crash courses',()=>{
  const month=iso=>new Date(access.addOneMonth(Date.parse(iso))).toISOString();
  assert.equal(month('2026-10-26T08:00:00.000Z'),'2026-11-26T08:00:00.000Z');
  assert.equal(month('2026-12-15T00:00:00.000Z'),'2027-01-15T00:00:00.000Z');
  assert.equal(month('2027-01-31T10:00:00.000Z'),'2027-02-28T10:00:00.000Z','short months end on their last day');
  assert.equal(month('2028-01-31T10:00:00.000Z'),'2028-02-29T10:00:00.000Z','leap years too');
  assert.equal(access.accessEndsAt('crash',t0),null);
  assert.equal(access.accessEndsAt('full',t0),new Date(access.addOneMonth(t0)).toISOString());
  assert.deepEqual([access.accessLabel('crash'),access.accessLabel('papers')],['Lifetime access','1 month access']);
  assert.equal(access.accessSummary({active:true,expiresAt:null}),'Lifetime access');
  assert.match(access.accessSummary({active:true,expiresAt:'2026-11-26T08:00:00.000Z'}),/^Access until 26 November 2026$/);
  assert.match(access.accessSummary({active:false,expiresAt:'2026-11-26T08:00:00.000Z'}),/^Access ended 26 November 2026$/);
});

test('Paying for a full course gives one month; a crash course gives lifetime access',async()=>{
  const {db,sqlite,student}=setup();
  addCourseRecord(sqlite,'physics-as','full');addCourseRecord(sqlite,'physics-crash','crash');
  for(const [slug,expected] of [['physics-as',new Date(access.addOneMonth(t0)).toISOString()],['physics-crash',null]]){
    const order=await pay.createOrder(db,student,{...course,id:slug},{email:'a@b.co',phone:'+8801712345678'},t0);
    const g=gateway();g.calls.tran=order.tranId;
    await pay.settleOrder(db,config,order.tranId,'VAL1',g.fetcher,t0);
    assert.equal((await pay.enrolmentFor(db,student.id,slug,t0)).expires_at,expected,slug);
  }
  assert.equal(await pay.isEnrolled(db,student.id,'physics-crash',t0+10*365*864e5),true,'lifetime never ends');
});

test('Expired access stops counting, and paying again renews it',async()=>{
  const {db,sqlite,student}=setup();
  addCourseRecord(sqlite,'physics-as','full');
  const first=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  const g1=gateway();g1.calls.tran=first.tranId;
  await pay.settleOrder(db,config,first.tranId,'VAL1',g1.fetcher,t0);
  const ends=Date.parse((await pay.enrolmentFor(db,student.id,'physics-as',t0)).expires_at);
  assert.equal(await pay.isEnrolled(db,student.id,'physics-as',ends-1000),true);
  assert.equal(await pay.isEnrolled(db,student.id,'physics-as',ends+1000),false,'access ends on the end date');
  assert.equal((await pay.enrolmentsFor(db,student.id,ends+1000))[0].active,false);
  await failsWith(pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},ends-10*864e5),409,'no buying twice while access has more than a week left');
  const later=ends+5*864e5;
  const second=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},later);
  const g2=gateway();g2.calls.tran=second.tranId;
  await pay.settleOrder(db,config,second.tranId,'VAL1',g2.fetcher,later);
  const renewed=await pay.enrolmentFor(db,student.id,'physics-as',later);
  assert.equal(renewed.active,true);assert.equal(renewed.expires_at,new Date(access.addOneMonth(later)).toISOString());
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM enrolments').get().n,1,'renewal updates the same enrolment');
});

test('In the last week, renewing adds a month from the current end date',async()=>{
  const {db,sqlite,student}=setup();
  addCourseRecord(sqlite,'physics-as','full');
  const first=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0);
  const g1=gateway();g1.calls.tran=first.tranId;
  await pay.settleOrder(db,config,first.tranId,'VAL1',g1.fetcher,t0);
  const ends=(await pay.enrolmentFor(db,student.id,'physics-as',t0)).expires_at;
  const early=Date.parse(ends)-3*864e5;
  assert.equal(await pay.mayBuy(db,student.id,'physics-as',Date.parse(ends)-8*864e5),false);
  assert.equal(await pay.mayBuy(db,student.id,'physics-as',early),true);
  const second=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},early);
  const g2=gateway();g2.calls.tran=second.tranId;
  await pay.settleOrder(db,config,second.tranId,'VAL1',g2.fetcher,early);
  assert.equal((await pay.enrolmentFor(db,student.id,'physics-as',early)).expires_at,new Date(access.addOneMonth(Date.parse(ends))).toISOString(),'no days are lost');
});

test('Reminders start a week before monthly access ends',()=>{
  const now=t0,day=864e5,at=d=>new Date(now+d).toISOString();
  assert.equal(access.endingSoon({active:true,expiresAt:at(8*day)},now),false);
  assert.equal(access.endingSoon({active:true,expiresAt:at(7*day)},now),true);
  assert.equal(access.endingSoon({active:true,expiresAt:null},now),false,'lifetime access never ends');
  assert.equal(access.endingSoon({active:false,expiresAt:at(-day)},now),false,'ended access shows Renew instead');
  assert.equal(access.endingSoon(null,now),false);
  assert.match(access.endingNotice({active:true,expiresAt:at(3*day)},now),/^Your access ends in 3 days, on /);
  assert.match(access.endingNotice({active:true,expiresAt:at(day/2)},now),/^Your access ends tomorrow/,'16:00 + 12 hours is tomorrow in Dhaka');
  assert.match(access.endingNotice({active:true,expiresAt:at(3*3600e3)},now),/^Your access ends today/);
  assert.equal(access.canBuy({active:true,expiresAt:at(20*day)},now),false);
  assert.equal(access.canBuy({active:true,expiresAt:at(2*day)},now),true);
  assert.equal(access.canBuy({active:true,expiresAt:null},now),false);
});

test('Discount codes lower the price, are checked against course, dates and uses, and count a use when paid',async()=>{
  const {db,sqlite,student}=setup();
  addCourseRecord(sqlite,'physics-as','full');
  const code=(c,percent,extra={})=>sqlite.prepare('INSERT INTO discount_codes(code,percent,course_slug,starts_at,ends_at,max_uses,uses,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(c,percent,extra.course??null,extra.starts??null,extra.ends??null,extra.max??null,extra.uses??0,extra.active??1,'x','x');
  code('EID20',20);code('CHEM10',10,{course:'chemistry'});code('LATER',10,{starts:'2026-11-01T00:00:00Z'});code('OLD',10,{ends:'2026-10-01T00:00:00Z'});code('FULL',10,{max:5,uses:5});code('OFF',10,{active:0});
  const failsMsg=(input,pattern)=>assert.rejects(disc.findDiscount(db,input,'physics-as',t0),e=>e instanceof pay.PaymentFailure&&pattern.test(e.message));
  assert.equal((await disc.findDiscount(db,' eid20 ','physics-as',t0)).percent,20,'codes ignore case and spaces');
  await failsMsg('NOPE',/isn’t valid/);await failsMsg('OFF',/isn’t valid/);await failsMsg('CHEM10',/isn’t for this course/);
  await failsMsg('LATER',/isn’t active yet/);await failsMsg('OLD',/expired/);await failsMsg('FULL',/fully used/);await failsMsg('<script>',/isn’t valid/);
  assert.equal(pay.discountedPrice(449900,20),359900);
  assert.equal(pay.discountedPrice(449900,15),382400,'rounded to whole taka');
  assert.equal(pay.discountedPrice(1200,90),pay.MIN_PRICE_MINOR,'never below the gateway minimum');
  const discount=await disc.findDiscount(db,'EID20','physics-as',t0);
  const order=await pay.createOrder(db,student,course,{email:'a@b.co',phone:'+8801712345678'},t0,discount);
  assert.deepEqual([order.amountMinor,order.discountCode,order.listPriceMinor],[359900,'EID20',449900]);
  const g=gateway({amount:'3599.00'});g.calls.tran=order.tranId;
  await pay.settleOrder(db,config,order.tranId,'VAL1',g.fetcher,t0);
  assert.equal(sqlite.prepare("SELECT uses FROM discount_codes WHERE code='EID20'").get().uses,1);
  await pay.settleOrder(db,config,order.tranId,'VAL1',g.fetcher,t0);
  assert.equal(sqlite.prepare("SELECT uses FROM discount_codes WHERE code='EID20'").get().uses,1,'a repeated confirmation is not a second use');
  assert.match(sqlite.prepare("SELECT data FROM records WHERE kind='payment'").get().data,/code EID20/);
  const plain=await pay.createOrder(db,{...student,id:'stu-2'},course,{email:'a@b.co',phone:'+8801712345678'},t0);
  assert.deepEqual([plain.amountMinor,plain.discountCode],[449900,null]);
});
