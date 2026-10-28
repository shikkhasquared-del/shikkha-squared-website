import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const output=path.resolve('.test-output/files'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
await fs.writeFile(output+'/files.mjs',ts.transpileModule(await fs.readFile('lib/files.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const F=await import(outputUrl+'/files.mjs');
const sql=(await Promise.all((await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile('drizzle/'+f,'utf8')))).join('\n');
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);
  sqlite.exec("CREATE TABLE records(id text,kind text,status text,data text,archived_at text)");
  return {sqlite,prepare(query){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sqlite.prepare(query).get(...args)||null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){return sqlite.prepare(query).run(...args);}};return statement;}};
}
const id='0b9c4f7e-1d2a-4c3b-9e8f-112233445566';

test('Only "/media/<id>" lesson links count as uploaded worksheets',()=>{
  assert.equal(F.lessonFileId('/media/'+id),id);
  for(const bad of ['https://evil.test/media/'+id,'/media/'+id+'/x','/media/not-an-id','',' /media/'+id])assert.equal(F.lessonFileId(bad),null,bad);
});

test('File downloads stop at the monthly cap and start again next month',async()=>{
  const db=database();
  const oct=Date.parse('2026-10-28T10:00:00Z'),nov=Date.parse('2026-11-01T00:00:01Z');
  assert.equal(await F.takeDownload(db,oct),true);
  db.sqlite.prepare("UPDATE file_downloads SET count=? WHERE month='2026-10'").run(F.DOWNLOADS_PER_MONTH-1);
  assert.equal(await F.takeDownload(db,oct),true,'the last allowed download');
  assert.equal(await F.takeDownload(db,oct),false);
  assert.equal(db.sqlite.prepare("SELECT count FROM file_downloads WHERE month='2026-10'").get().count,F.DOWNLOADS_PER_MONTH,'refusals are not counted');
  assert.equal(await F.takeDownload(db,nov),true);
});

test('Worksheets come from current uploaded files only, and PDFs open in the browser',async()=>{
  const db=database();
  db.sqlite.prepare("INSERT INTO records VALUES(?,?,?,?,NULL)").run(id,'asset','private',JSON.stringify({key:'uploads/'+id,mime:'application/pdf',fileName:'Kinematics "worksheet".pdf',size:1200}));
  db.sqlite.prepare("INSERT INTO records VALUES(?,?,?,?,?)").run('old','asset','private','{}','2026-01-01');
  const file=await F.storedFile(db,id);
  assert.deepEqual(file,{key:'uploads/'+id,mime:'application/pdf',fileName:'Kinematics "worksheet".pdf',size:1200,status:'private'});
  assert.equal(await F.storedFile(db,'old'),null,'archived files are not served');
  const h=F.fileHeaders(file);
  assert.equal(h.get('content-disposition'),'inline; filename="Kinematics _worksheet_.pdf"');
  assert.equal(h.get('x-content-type-options'),'nosniff');
  const other=F.fileHeaders({...file,mime:'video/mp4',fileName:'clip.mp4'});
  assert.match(other.get('content-disposition'),/^attachment/);
  assert.match(other.get('content-security-policy'),/sandbox/);
});
