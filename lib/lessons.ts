import { createHash } from 'node:crypto';

// Course lessons and protected video playback.
// Videos are HLS streams on Tenbyte's CDN. The player never sees the real playlist address: it asks
// this site for the playlist, which checks the student's access, fetches the playlist from Tenbyte
// and rewrites it so nested playlists come back through this site and every video piece points at
// Tenbyte with its own expiring signature (Tenbyte token authentication).

export const SEGMENT_TTL_S=6*60*60; // long enough for one sitting; Tenbyte suggests 2–6 hours for VOD
export type Lesson={title:string;kind:string;resourceUrl:string;notes:string;duration:string;free:boolean};
export type VideoSource={origin:string;rootPath:string;masterPath:string};

// Only HLS playlists on Tenbyte (or hosts listed in TENBYTE_HOSTS) are streamed through the site.
export function videoSource(url:string,allowedHosts:string[]=['.tenbytecdn.com']):VideoSource|null {
  let u:URL;try{u=new URL(url);}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||!u.pathname.endsWith('.m3u8'))return null;
  const host=u.hostname.toLowerCase();
  if(!allowedHosts.some(h=>h.startsWith('.')?host.endsWith(h):host===h))return null;
  return {origin:u.origin,rootPath:u.pathname.slice(0,u.pathname.lastIndexOf('/')+1),masterPath:u.pathname};
}

// Tenbyte signature: base64url(md5("{expires}{path} {secret}")), appended as ?md5=…&expires=….
export function tenbyteUrl(origin:string,path:string,secret:string|undefined,expires:number){
  if(!secret)return origin+path;
  const md5=createHash('md5').update(`${expires}${path} ${secret}`).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${origin}${path}?md5=${md5}&expires=${expires}`;
}

// A playlist path inside the video's folder, from the part of the site URL after /stream/<lesson>/.
export function playlistPath(source:VideoSource,relative:string):string|null {
  if(!relative)return source.masterPath;
  if(!/^[A-Za-z0-9._\/-]+\.m3u8$/.test(relative)||relative.split('/').some(p=>p===''||p==='.'||p==='..'))return null;
  return source.rootPath+relative;
}

// Rewrites every URI in a playlist (plain lines and URI="…" attributes).
export function rewritePlaylist(text:string,playlistPath:string,source:VideoSource,proxyBase:string,secret:string|undefined,expires:number){
  const base=new URL(source.origin+playlistPath);
  const mapUri=(uri:string)=>{
    let abs:URL;try{abs=new URL(uri,base);}catch{return uri;}
    if(abs.origin!==source.origin)return uri;
    if(abs.pathname.startsWith(source.rootPath)&&abs.pathname.endsWith('.m3u8'))return proxyBase+abs.pathname.slice(source.rootPath.length);
    return tenbyteUrl(source.origin,abs.pathname,secret,expires);
  };
  return text.split(/\r?\n/).map(line=>{
    const t=line.trim();
    if(!t)return line;
    if(t.startsWith('#'))return line.replace(/URI="([^"]+)"/g,(_,uri)=>`URI="${mapUri(uri)}"`);
    return mapUri(t);
  }).join('\n');
}

export function courseLessons(course:any):Lesson[]{
  return (Array.isArray(course?.lessons)?course.lessons:[]).map((l:any)=>({title:String(l.title||'Lesson'),kind:String(l.kind||'video'),resourceUrl:String(l.resourceUrl||''),notes:String(l.notes||''),duration:String(l.duration||''),free:l.free===true}));
}
export const canOpen=(lesson:Lesson|undefined,enrolled:boolean)=>!!lesson&&(enrolled||lesson.free);
