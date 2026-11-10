import { loadClassroom } from '../../../../lib/classroom';
import { canOpen } from '../../../../lib/lessons';
import { recordProgress } from '../../../../lib/progress';
import { isSameOrigin } from '../../../../lib/student-auth';
import { redirectResponse } from '../../../../lib/student-server';
export const dynamic='force-dynamic';

const reply=(status:number)=>new Response(null,{status,headers:{'cache-control':'no-store'}});

// POST /learn/<course>/progress
// From the video player (JSON: lesson, position, duration, done) or the "Mark as done" form.
export async function POST(request:Request){
  const slug=new URL(request.url).pathname.match(/^\/learn\/([a-z0-9]+(?:-[a-z0-9]+)*)\/progress$/)?.[1];
  if(!slug)return reply(404);
  if(!isSameOrigin(request))return reply(403);
  const type=request.headers.get('content-type')||'';
  const fromForm=type.includes('application/x-www-form-urlencoded')||type.includes('multipart/form-data');
  try{
    let input:{lesson?:unknown;position?:unknown;duration?:unknown;done?:unknown}|null;
    if(fromForm){
      const form = await request.formData();
      input = {lesson: form.get('lesson'), done: form.get('done') === '1'};
    } else {
      const text = await request.text();
      input = JSON.parse(text);
    }
    const room=await loadClassroom(request,slug);
    const index=Number(input?.lesson),lesson=Number.isInteger(index)?room?.lessons[index]:undefined;
    if(!room?.student)return fromForm?redirectResponse('/login?next='+encodeURIComponent(`/learn/${slug}`)):reply(401);
    if(!lesson||!canOpen(lesson,room.enrolled))return reply(403);
    await recordProgress(room.student.id,slug,lesson.id,{position:input!.position,duration:input!.duration,done:input!.done===true});
    if(!fromForm)return reply(204);
    // After marking a lesson done, carry on to the next one.
    return redirectResponse(`/learn/${slug}?lesson=${index<room.lessons.length-1?index+1:index}`);
  }catch(error){return reply(400);}
}
