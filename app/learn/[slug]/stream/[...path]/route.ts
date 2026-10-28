import { fetchFromTenbyte, loadClassroom, tenbyteHosts } from '../../../../../lib/classroom';
import { canOpen, isPlaylist, mediaPath, rewritePlaylist, videoSource } from '../../../../../lib/lessons';
import { noteActivity } from '../../../../../lib/student-server';
export const dynamic='force-dynamic';

const deny=(status:number,message:string)=>new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
const PASSED_ON=['content-type','content-length','content-range','accept-ranges','etag','last-modified'];

// GET /learn/<course>/stream/<lesson number>/<file inside the video folder>
// Every playlist and video piece comes through here, so each request is checked against the student's access.
export async function GET(request:Request){
  const match=new URL(request.url).pathname.match(/^\/learn\/([a-z0-9]+(?:-[a-z0-9]+)*)\/stream\/(\d{1,3})\/(.+)$/);
  if(!match)return deny(404,'Not found.');
  const [,slug,number,relative]=match;
  try{
    const room=await loadClassroom(request,slug);
    const lesson=room?.lessons[Number(number)];
    if(!room||!lesson)return deny(404,'Not found.');
    if(!canOpen(lesson,room.enrolled))return deny(room.student?403:401,'Enrol in this course to watch this lesson.');
    const source=videoSource(lesson.resourceUrl,tenbyteHosts());
    const path=source&&mediaPath(source,relative);
    if(!source||!path)return deny(404,'Not found.');
    const headers=new Headers();
    const range=request.headers.get('range');
    if(range)headers.set('range',range);
    const upstream=await fetchFromTenbyte(source.origin+path,headers,isPlaylist(path)?10000:30000);
    if(!upstream.ok){console.error('Video origin refused',upstream.status,source.origin,path);return deny(502,'The video is temporarily unavailable.');}
    if(isPlaylist(path)){
      // The main playlist is fetched once each time a student starts a lesson video.
      if(path===source.masterPath&&room.student)await noteActivity(request,room.student.id,'watch');
      const body=rewritePlaylist(await upstream.text(),path,source,`/learn/${slug}/stream/${number}/`);
      return new Response(body,{headers:{'content-type':'application/vnd.apple.mpegurl','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
    }
    const out=new Headers({'cache-control':'private, max-age=21600','x-content-type-options':'nosniff'});
    for(const name of PASSED_ON){const value=upstream.headers.get(name);if(value)out.set(name,value);}
    return new Response(upstream.body,{status:upstream.status,headers:out});
  }catch{return deny(503,'The video is temporarily unavailable.');}
}
