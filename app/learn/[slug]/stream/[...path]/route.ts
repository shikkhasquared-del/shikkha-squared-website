import { loadClassroom, tenbyteHosts, tenbyteSecret } from '../../../../../lib/classroom';
import { SEGMENT_TTL_S, canOpen, playlistPath, rewritePlaylist, tenbyteUrl, videoSource } from '../../../../../lib/lessons';
export const dynamic='force-dynamic';

const deny=(status:number,message:string)=>new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});

// GET /learn/<course>/stream/<lesson number>/<playlist path inside the video folder>
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
    const path=source&&playlistPath(source,relative);
    if(!source||!path)return deny(404,'Not found.');
    const secret=tenbyteSecret(),now=Math.floor(Date.now()/1000);
    const upstream=await fetch(tenbyteUrl(source.origin,path,secret,now+60),{signal:AbortSignal.timeout(10000)});
    if(!upstream.ok)return deny(502,'The video is temporarily unavailable.');
    const body=rewritePlaylist(await upstream.text(),path,source,`/learn/${slug}/stream/${number}/`,secret,now+SEGMENT_TTL_S);
    return new Response(body,{headers:{'content-type':'application/vnd.apple.mpegurl','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  }catch{return deny(503,'The video is temporarily unavailable.');}
}
