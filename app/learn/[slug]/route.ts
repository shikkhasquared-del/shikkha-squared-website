import { missingPage, unavailablePage } from '../../../lib/catalog-pages';
import { loadClassroom, tenbyteHosts } from '../../../lib/classroom';
import { classroomPage } from '../../../lib/classroom-pages';
import { routeSlug } from '../../../lib/route-slug';
export const dynamic='force-dynamic';
const blank={courses:[],sections:[],instructors:[],settings:{},campaigns:[]};
export async function GET(request:Request){
  const slug=routeSlug(request);
  if(!slug)return missingPage(blank,'courses');
  try{
    const room=await loadClassroom(request,slug);
    if(!room)return missingPage(blank,'courses');
    const lesson=new URL(request.url).searchParams.get('lesson');
    return classroomPage(room,lesson===null?-1:Number(lesson),tenbyteHosts());
  }catch{return unavailablePage();}
}
