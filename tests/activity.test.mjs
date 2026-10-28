import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const output=path.resolve('.test-output/activity'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
for(const name of ['student-auth','activity']){
  const source=await fs.readFile('lib/'+name+'.ts','utf8');
  await fs.writeFile(output+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from './student-auth'","from './student-auth.mjs'"));
}
const A=await import(outputUrl+'/activity.mjs');
const sql=(await Promise.all((await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile('drizzle/'+f,'utf8')))).join('\n');
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);
  return {sqlite,prepare(query){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sqlite.prepare(query).get(...args)||null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){return sqlite.prepare(query).run(...args);}};return statement;}};
}
const t0=Date.parse('2026-10-28T10:00:00Z'),day=864e5;
const place={ip:'103.4.145.10',city:'Dhaka',country:'bd',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'};

test('Device types are coarse labels',()=>{
  assert.equal(A.deviceLabel(place.userAgent),'iPhone');
  assert.equal(A.deviceLabel('Mozilla/5.0 (Linux; Android 14; SM-A145F)'),'Android');
  assert.equal(A.deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),'Windows');
  assert.equal(A.deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),'Mac');
  assert.equal(A.deviceLabel(''),'');
});

test('Activity keeps a scrambled network code, never the address, and forgets after 90 days',async()=>{
  const db=database();
  await A.recordActivity(db,'s1','sign-in',place,'pepper',t0-91*day);
  await A.recordActivity(db,'s2','watch',place,'pepper',t0-91*day);
  await A.recordActivity(db,'s1','watch',place,'pepper',t0);
  const rows=db.sqlite.prepare('SELECT * FROM account_activity ORDER BY created_at').all();
  assert.deepEqual(rows.map(r=>[r.student_id,r.kind]),[['s2','watch'],['s1','watch']],'s1’s old row is deleted; other students are untouched');
  const row=rows[1];
  assert.deepEqual([row.city,row.country,row.device],['Dhaka','BD','iPhone']);
  assert.equal(row.network.length,16);
  assert.equal(JSON.stringify(rows).includes('103.4.145.10'),false);
  await A.recordActivity(db,'s1','watch',{...place,ip:'103.4.145.11'},'pepper',t0);
  await A.recordActivity(db,'s1','watch',place,'pepper',t0);
  const networks=db.sqlite.prepare("SELECT network FROM account_activity WHERE student_id='s1'").all().map(r=>r.network);
  assert.equal(networks[0],networks[2],'the same network gives the same code');
  assert.notEqual(networks[0],networks[1]);
});
