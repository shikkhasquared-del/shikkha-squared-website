import { readCMS } from '../../../lib/cms-read';
import { storedFile, takeDownload } from '../../../lib/files';
import { studentDb } from '../../../lib/student-server';
export const dynamic='force-dynamic';
// Public files the admin marked "public". Only real public files are counted towards the monthly R2 read cap,
// so made-up links can't use it up.
export async function GET(request:Request){try{const id=new URL(request.url).pathname.split('/').at(-1)!;if(!/^[a-f0-9-]{36}$/.test(id))return new Response('File not found.',{status:404});const db=studentDb(),file=await storedFile(db,id);if(!file||file.status!=='published')return new Response('File not found.',{status:404});if(!await takeDownload(db))return new Response('Files are paused until the start of next month.',{status:503});const result=await readCMS('/api/published/media/'+id);if(!result.ok)return new Response('File not found.',{status:404});const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff'});for(const key of ['content-type','content-disposition','content-security-policy']){const value=result.headers.get(key);if(value)headers.set(key,value);}return new Response(result.body,{headers});}catch{return new Response('File unavailable.',{status:503});}}
