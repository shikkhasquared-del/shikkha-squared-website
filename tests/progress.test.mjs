import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const output=path.resolve('.test-output/progress'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
await fs.writeFile(output+'/progress.mjs',ts.transpileModule(await fs.readFile('lib/progress.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const P=await import(outputUrl+'/progress.mjs');
const sql=(await Promise.all((await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile('drizzle/'+f,'utf8')))).join('\n');
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);
  // The course records table belongs to the admin's database schema.
  sqlite.exec("CREATE TABLE records(id text,kind text,unique_key text,data text,archived_at text)");
  return {sqlite,prepare(query){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sqlite.prepare(query).get(...args)||null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){return sqlite.prepare(query).run(...args);}};return statement;}};
}
const t0=Date.parse('2026-10-28T10:00:00Z');
const lessons=[{id:'a',title:'One'},{id:'b',title:'Two'},{id:'c',title:'Three'}];
const all=()=>true;

test('A video counts as finished at 90% watched, and stays finished when rewatched',async()=>{
  const db=database();
  await P.recordProgress(db,'s1','phys','a',{position:300,duration:1000},t0);
  let p=(await P.progressFor(db,'s1','phys')).get('a');
  assert.deepEqual({pos:p.positionS,dur:p.durationS,done:p.completed},{pos:300,dur:1000,done:false});
  await P.recordProgress(db,'s1','phys','a',{position:905,duration:1000},t0+1000);
  assert.equal((await P.progressFor(db,'s1','phys')).get('a').completed,true);
  await P.recordProgress(db,'s1','phys','a',{position:20,duration:1000},t0+2000);
  p=(await P.progressFor(db,'s1','phys')).get('a');
  assert.equal(p.completed,true);assert.equal(p.positionS,20);
  await P.recordProgress(db,'s1','phys','b',{done:true},t0);
  assert.equal((await P.progressFor(db,'s1','phys')).get('b').completed,true,'"Mark as done" finishes non-video lessons');
});

test('Progress values are cleaned up and kept per student and course',async()=>{
  const db=database();
  await P.recordProgress(db,'s1','phys','a',{position:'-5',duration:'abc'},t0);
  await P.recordProgress(db,'s1','phys','b',{position:5000,duration:1000},t0);
  const p=await P.progressFor(db,'s1','phys');
  assert.deepEqual([p.get('a').positionS,p.get('a').durationS],[0,0]);
  assert.equal(p.get('b').positionS,1000,'position never goes past the end');
  assert.equal((await P.progressFor(db,'s2','phys')).size,0);
  assert.equal((await P.progressFor(db,'s1','chem')).size,0);
});

test('Opening a course lands on the lesson to carry on with',()=>{
  const map=entries=>new Map(entries.map(([id,completed,updatedAt])=>[id,{positionS:0,durationS:0,completed,updatedAt}]));
  assert.equal(P.resumeIndex(lessons,new Map(),all),0,'new students start at the first lesson');
  assert.equal(P.resumeIndex(lessons,new Map(),l=>l.id!=='a'),1,'or the first one they can open');
  assert.equal(P.resumeIndex(lessons,map([['a',true,'1'],['b',false,'2']]),all),1,'the lesson they were in the middle of');
  assert.equal(P.resumeIndex(lessons,map([['a',true,'1'],['b',true,'2']]),all),2,'the next lesson after the one they finished');
  assert.equal(P.resumeIndex(lessons,map([['c',true,'3'],['b',false,'1']]),all),1,'after the last lesson, back to a half-done one');
  assert.equal(P.resumeIndex(lessons,map([['c',true,'3'],['b',true,'1']]),all),0,'otherwise the first unfinished one');
  assert.equal(P.resumeIndex(lessons,map([['a',true,'1'],['b',true,'2'],['c',true,'3']]),all),2,'the last lesson stays when everything is done');
});

test('Videos resume from the saved spot unless finished, barely started or nearly over',()=>{
  const p=(positionS,durationS,completed=false)=>({positionS,durationS,completed,updatedAt:''});
  assert.equal(P.resumeAt(undefined),0);
  assert.equal(P.resumeAt(p(10,1000)),0);
  assert.equal(P.resumeAt(p(750,1000)),750);
  assert.equal(P.resumeAt(p(990,1000)),0);
  assert.equal(P.resumeAt(p(750,1000,true)),0);
  assert.equal(P.clock(754),'12:34');
  assert.equal(P.clock(3725),'1:02:05');
});

test('Course progress counts finished lessons that are still in the course',async()=>{
  const db=database();
  db.sqlite.prepare('INSERT INTO records VALUES(?,?,?,?,NULL)').run('r1','course','phys',JSON.stringify({lessons:[{id:'a'},{id:'b'},{}]}));
  await P.recordProgress(db,'s1','phys','a',{done:true},t0);
  await P.recordProgress(db,'s1','phys','i2',{done:true},t0+1000);
  await P.recordProgress(db,'s1','phys','removed',{done:true},t0+2000);
  await P.recordProgress(db,'s1','phys','b',{position:30,duration:600},t0+3000);
  const c=(await P.courseProgressFor(db,'s1')).get('phys');
  assert.deepEqual(c,{done:2,total:3,lastAt:new Date(t0+3000).toISOString()});
  assert.equal((await P.courseProgressFor(db,'s2')).size,0);
});
