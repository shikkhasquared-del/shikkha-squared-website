import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const output=path.resolve('.test-output/payments'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
for(const name of ['student-auth','payments']){
  const source=await fs.readFile('lib/'+name+'.ts','utf8');
  await fs.writeFile(output+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from './student-auth'","from './student-auth.mjs'"));
}
const pay=await import(outputUrl+'/payments.mjs');
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
