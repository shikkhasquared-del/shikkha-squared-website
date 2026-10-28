// Course lessons and protected video playback.
// Videos are HLS streams on Tenbyte's CDN. The browser never sees Tenbyte's address: every playlist and
// video piece is requested from this site, which checks the student's access and fetches it from Tenbyte.
// Tenbyte only answers requests carrying this site's private referrer (TENBYTE_REFERRER), so a copied
// Tenbyte address doesn't play anywhere else.

export type Lesson={id:string;title:string;kind:string;resourceUrl:string;notes:string;duration:string;free:boolean};
export type VideoSource={origin:string;rootPath:string;masterPath:string};

// Only HLS playlists on Tenbyte (or hosts listed in TENBYTE_HOSTS) are streamed through the site.
export function videoSource(url:string,allowedHosts:string[]=['.tenbytecdn.com']):VideoSource|null {
  let u:URL;try{u=new URL(url);}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||!u.pathname.endsWith('.m3u8'))return null;
  const host=u.hostname.toLowerCase();
  if(!allowedHosts.some(h=>h.startsWith('.')?host.endsWith(h):host===h))return null;
  return {origin:u.origin,rootPath:u.pathname.slice(0,u.pathname.lastIndexOf('/')+1),masterPath:u.pathname};
}

const MEDIA=/\.(m3u8|ts|m4s|mp4|aac|vtt|key|bin)$/;
export const isPlaylist=(path:string)=>path.endsWith('.m3u8');

// A file inside the video's folder, from the part of the site URL after /stream/<lesson>/.
export function mediaPath(source:VideoSource,relative:string):string|null {
  if(!relative)return source.masterPath;
  if(!/^[A-Za-z0-9._\/-]+$/.test(relative)||!MEDIA.test(relative)||relative.split('/').some(p=>p===''||p==='.'||p==='..'))return null;
  return source.rootPath+relative;
}

// Rewrites every URI in a playlist (plain lines and URI="…" attributes) to come back through this site.
export function rewritePlaylist(text:string,playlistPath:string,source:VideoSource,proxyBase:string){
  const base=new URL(source.origin+playlistPath);
  const mapUri=(uri:string)=>{
    let abs:URL;try{abs=new URL(uri,base);}catch{return uri;}
    if(abs.origin!==source.origin||!abs.pathname.startsWith(source.rootPath))return uri;
    return proxyBase+abs.pathname.slice(source.rootPath.length);
  };
  return text.split(/\r?\n/).map(line=>{
    const t=line.trim();
    if(!t)return line;
    if(t.startsWith('#'))return line.replace(/URI="([^"]+)"/g,(_,uri)=>`URI="${mapUri(uri)}"`);
    return mapUri(t);
  }).join('\n');
}

export function courseLessons(course:any):Lesson[]{
  return (Array.isArray(course?.lessons)?course.lessons:[]).map((l:any,i:number)=>({id:String(l.id||'i'+i).slice(0,60),title:String(l.title||'Lesson'),kind:String(l.kind||'video'),resourceUrl:String(l.resourceUrl||''),notes:String(l.notes||''),duration:String(l.duration||''),free:l.free===true}));
}
export const canOpen=(lesson:Lesson|undefined,enrolled:boolean)=>!!lesson&&(enrolled||lesson.free);
