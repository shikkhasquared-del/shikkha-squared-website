import { env } from 'cloudflare:workers';
import { loadClassroom } from '../../../../../lib/classroom';
import { canOpen } from '../../../../../lib/lessons';
import { fileHeaders, lessonFileId, storedFile, takeDownload } from '../../../../../lib/files';
import { redirect, studentDb } from '../../../../../lib/student-server';
export const dynamic='force-dynamic';

const deny=(status:number,message:string)=>new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});

// GET /learn/<course>/file/<lesson number>: the lesson's worksheet, for students who can open the lesson.
export async function GET(request:Request){
  const match=new URL(request.url).pathname.match(/^\/learn\/([a-z0-9]+(?:-[a-z0-9]+)*)\/file\/(\d{1,3})$/);
  if(!match)return deny(404,'Not found.');
  const [,slug,number]=match;
  try{
    const room=await loadClassroom(request,slug);
    const lesson=room?.lessons[Number(number)];
    const id=lesson&&lessonFileId(lesson.resourceUrl);
    if(!room||!lesson||!id)return deny(404,'Not found.');
    if(!canOpen(lesson,room.enrolled))return room.student?deny(403,'Enrol in this course to open this worksheet.'):redirect('/login?next='+encodeURIComponent(`/learn/${slug}?lesson=${number}`));
    const db=studentDb(),file=await storedFile(db,id);
    if(!file||!env.BUCKET)return deny(404,'This worksheet is not available.');
    if(!await takeDownload(db))return deny(503,'Worksheets are paused until the start of next month. Please contact us if you need this one now.');
    const object=await env.BUCKET.get(file.key);
    if(!object)return deny(404,'This worksheet is not available.');
    return new Response(object.body,{headers:fileHeaders(file)});
  }catch{return deny(503,'This worksheet is temporarily unavailable.');}
}
