import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const output=path.resolve('.sites-runtime/test-student-auth'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
for(const name of ['student-auth','google-auth']){
  const source=await fs.readFile('lib/'+name+'.ts','utf8');
  await fs.writeFile(output+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from './student-auth'","from './student-auth.mjs'"));
}
const auth=await import(outputUrl+'/student-auth.mjs');
const google=await import(outputUrl+'/google-auth.mjs');
const sql=(await Promise.all((await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile('drizzle/'+f,'utf8')))).join('\n');
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);
  return {prepare(query){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sqlite.prepare(query).get(...args)||null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){return sqlite.prepare(query).run(...args);}};return statement;}};
}
const pepper='test-pepper',t0=Date.parse('2026-10-19T10:00:00Z');
const rejects=(promise,status)=>assert.rejects(promise,e=>e instanceof auth.AuthFailure&&e.status===status);

test('Bangladeshi mobile numbers are normalized and other input is rejected',()=>{
  for(const input of ['01712345678','+8801712345678','8801712345678','017-1234 5678','(017) 12345678'])assert.equal(auth.normalizePhone(input),'+8801712345678');
  for(const input of ['','0171234567','01212345678','+447700900000','01712345678x',null])assert.equal(auth.normalizePhone(input),null);
  assert.equal(auth.displayPhone('+8801712345678'),'01712-345678');
});

test('Sign-in destinations stay on this site',()=>{
  assert.equal(auth.safeNext('/courses/physics?x=1'),'/courses/physics?x=1');
  for(const bad of ['//evil.test','https://evil.test','/\\evil.test','javascript:alert(1)','',null])assert.equal(auth.safeNext(bad),'/account');
});

test('A code works once, only before it expires, and wrong guesses are limited',async()=>{
  const db=database(),phone='+8801712345678';
  const code=await auth.issueLoginCode(db,phone,'1.1.1.1',pepper,t0);
  assert.match(code,/^\d{6}$/);
  assert.equal((await db.prepare('SELECT code_hash FROM login_codes').first()).code_hash.includes(code),false);
  const wrong=code==='000000'?'111111':'000000';
  await rejects(auth.consumeLoginCode(db,phone,wrong,pepper,t0+1000),400);
  await auth.consumeLoginCode(db,phone,code,pepper,t0+2000);
  await rejects(auth.consumeLoginCode(db,phone,code,pepper,t0+3000),410);
  const late=await auth.issueLoginCode(db,phone,'1.1.1.1',pepper,t0+120000);
  await rejects(auth.consumeLoginCode(db,phone,late,pepper,t0+120000+auth.CODE_TTL_MS+1),410);
  const guessed=await auth.issueLoginCode(db,phone,'1.1.1.1',pepper,t0+240000);
  const other=guessed==='000000'?'111111':'000000';
  for(let i=0;i<auth.CODE_MAX_ATTEMPTS;i++)await rejects(auth.consumeLoginCode(db,phone,other,pepper,t0+241000),400);
  await rejects(auth.consumeLoginCode(db,phone,guessed,pepper,t0+242000),429);
  await rejects(auth.consumeLoginCode(db,phone,'12ab56',pepper,t0+242000),400);
});

test('Code requests are rate limited per number and per network',async()=>{
  const db=database(),phone='+8801812345678';
  await auth.issueLoginCode(db,phone,'2.2.2.2',pepper,t0);
  await rejects(auth.issueLoginCode(db,phone,'2.2.2.2',pepper,t0+30000),429);
  await auth.issueLoginCode(db,phone,'2.2.2.2',pepper,t0+61000);
  await auth.issueLoginCode(db,phone,'2.2.2.2',pepper,t0+122000);
  await rejects(auth.issueLoginCode(db,phone,'2.2.2.2',pepper,t0+183000),429);
  for(let i=0;i<auth.CODES_PER_IP-3;i++)await auth.issueLoginCode(db,'+88019'+String(10000000+i),'2.2.2.2',pepper,t0+184000);
  await rejects(auth.issueLoginCode(db,'+8801999999999','2.2.2.2',pepper,t0+185000),429);
  await rejects(auth.issueLoginCode(db,phone,'3.3.3.3','',t0),503);
});

test('Sessions identify the student until they expire or sign out',async()=>{
  const db=database();
  const student=await auth.studentForPhone(db,'+8801712345678',null,t0);
  const token=await auth.createSession(db,student.id,t0);
  assert.equal((await db.prepare('SELECT id FROM student_sessions').first()).id===token,false);
  assert.equal((await auth.sessionStudent(db,token,t0+1000)).id,student.id);
  assert.equal(await auth.sessionStudent(db,'not-a-token',t0),null);
  assert.equal(await auth.sessionStudent(db,token,t0+auth.SESSION_TTL_MS+1),null);
  const second=await auth.createSession(db,student.id,t0);
  await auth.endSession(db,second);
  assert.equal(await auth.sessionStudent(db,second,t0),null);
});

test('Phone and Google sign-ins find, create and link accounts without takeovers',async()=>{
  const db=database();
  const a=await auth.studentForPhone(db,'+8801712345678',null,t0);
  assert.equal((await auth.studentForPhone(db,'+8801712345678',null,t0)).id,a.id);
  const g=await auth.studentForGoogle(db,{sub:'google-1',email:'student@example.com',name:'Rafi Ahmed'},null,t0);
  assert.notEqual(g.id,a.id);assert.equal(g.name,'Rafi Ahmed');
  const sameEmail=await auth.studentForGoogle(db,{sub:'google-2',email:'student@example.com',name:'Someone'},null,t0);
  assert.notEqual(sameEmail.id,g.id,'matching by email alone must not sign in to another account');
  const linked=await auth.studentForGoogle(db,{sub:'google-3',email:'a@example.com',name:'A'},a,t0);
  assert.equal(linked.id,a.id);assert.equal(linked.googleSub,'google-3');
  await rejects(auth.studentForGoogle(db,{sub:'google-1',email:null,name:''},a,t0),409);
  await rejects(auth.studentForPhone(db,'+8801712345678',g,t0),409);
  assert.equal((await auth.studentForPhone(db,'+8801812345678',g,t0)).phone,'+8801812345678');
  assert.equal((await auth.updateStudentName(db,a,'  Nusrat   Jahan ',t0)).name,'Nusrat Jahan');
  await rejects(auth.updateStudentName(db,a,'   ',t0),400);
});

test('Google ID tokens are checked for audience, issuer, expiry and nonce',async()=>{
  const config={clientId:'client-1',clientSecret:'secret',redirectUri:'https://site.test/auth/google/callback'};
  const token=claims=>'x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.sig';
  const good={iss:'https://accounts.google.com',aud:'client-1',exp:t0/1000+600,nonce:'n1',sub:'123',email:'S@Example.com',email_verified:true,name:'Sadia'};
  assert.deepEqual(google.checkIdToken(token(good),config,'n1',t0),{sub:'123',email:'s@example.com',name:'Sadia'});
  assert.equal(google.checkIdToken(token({...good,email_verified:false}),config,'n1',t0).email,null);
  for(const bad of [{aud:'other'},{iss:'https://evil.test'},{exp:t0/1000-1},{nonce:'n2'},{sub:undefined}])assert.throws(()=>google.checkIdToken(token({...good,...bad}),config,'n1',t0),auth.AuthFailure);
  const {url,cookieValue}=await google.startGoogle(config,'/account');
  const pending=google.readPending(cookieValue),params=new URL(url).searchParams;
  assert.equal(params.get('state'),pending.state);assert.equal(params.get('code_challenge_method'),'S256');assert.equal(params.get('redirect_uri'),config.redirectUri);
  assert.equal(google.readPending('garbage'),null);
  await assert.rejects(google.finishGoogle(config,pending,new URLSearchParams({code:'c',state:'wrong'})),auth.AuthFailure);
});

test('Sign-in forms reject cross-site posts',()=>{
  assert.equal(auth.isSameOrigin(new Request('https://site.test/auth/phone/start',{method:'POST',headers:{origin:'https://site.test'}})),true);
  assert.equal(auth.isSameOrigin(new Request('https://site.test/auth/phone/start',{method:'POST',headers:{origin:'https://evil.test'}})),false);
  assert.equal(auth.isSameOrigin(new Request('https://site.test/auth/logout',{method:'POST',headers:{'sec-fetch-site':'cross-site'}})),false);
  assert.match(auth.cookie(new Request('https://site.test/'),'ss_session','abc',{maxAge:60}),/HttpOnly; SameSite=Lax; Secure$/);
  assert.equal(auth.readCookie(new Request('https://site.test/',{headers:{cookie:'a=1; ss_session=tok'}}),'ss_session'),'tok');
});
