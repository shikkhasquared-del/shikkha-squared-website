import type { Lesson } from './lessons';

// Lesson progress: where each student stopped in each lesson, and which lessons they have finished.
// Videos count as finished once 90% has been watched; other lessons when the student marks them done.

export const DONE_SHARE=0.9;
export type Progress={positionS:number;durationS:number;completed:boolean;updatedAt:string};
export type CourseProgress={done:number;total:number;lastAt:string|null};

const whole=(value:unknown,max:number)=>{const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?Math.min(n,max):0;};

export async function recordProgress(db:D1Database,studentId:string,courseSlug:string,lessonId:string,input:{position?:unknown;duration?:unknown;done?:unknown},now=Date.now()){
  const durationS=whole(input.duration,24*60*60),positionS=Math.min(whole(input.position,24*60*60),durationS||24*60*60);
  const done=input.done===true||(durationS>0&&positionS>=durationS*DONE_SHARE);
  const at=new Date(now).toISOString();
  // A finished lesson stays finished, even if the student rewatches the start of it.
  await db.prepare(`INSERT INTO lesson_progress(student_id,course_slug,lesson_id,position_s,duration_s,completed_at,updated_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(student_id,course_slug,lesson_id) DO UPDATE SET position_s=excluded.position_s,duration_s=max(lesson_progress.duration_s,excluded.duration_s),completed_at=coalesce(lesson_progress.completed_at,excluded.completed_at),updated_at=excluded.updated_at`)
    .bind(studentId,courseSlug,lessonId,positionS,durationS,done?at:null,at).run();
}

export async function progressFor(db:D1Database,studentId:string,courseSlug:string){
  const rows=(await db.prepare('SELECT lesson_id,position_s,duration_s,completed_at,updated_at FROM lesson_progress WHERE student_id=? AND course_slug=?').bind(studentId,courseSlug).all<any>()).results;
  return new Map<string,Progress>(rows.map(r=>[r.lesson_id,{positionS:r.position_s,durationS:r.duration_s,completed:!!r.completed_at,updatedAt:r.updated_at}]));
}

// Finished lessons out of the course's current lessons, for every course the student has started.
export async function courseProgressFor(db:D1Database,studentId:string){
  const rows=(await db.prepare(`SELECT p.course_slug,p.lesson_id,p.completed_at,p.updated_at,r.data FROM lesson_progress p
    LEFT JOIN records r ON r.kind='course' AND r.unique_key=p.course_slug AND r.archived_at IS NULL WHERE p.student_id=?`).bind(studentId).all<any>()).results;
  const out=new Map<string,CourseProgress>();
  const lessonIds=new Map<string,Set<string>>();
  for(const r of rows){
    if(!lessonIds.has(r.course_slug)){
      let lessons:any[]=[];try{lessons=JSON.parse(r.data||'{}').lessons||[];}catch{}
      lessonIds.set(r.course_slug,new Set(lessons.map((l:any,i:number)=>String(l.id||'i'+i).slice(0,60))));
    }
    const ids=lessonIds.get(r.course_slug)!;
    const entry=out.get(r.course_slug)||{done:0,total:ids.size,lastAt:null};
    if(r.completed_at&&ids.has(r.lesson_id))entry.done++;
    if(!entry.lastAt||r.updated_at>entry.lastAt)entry.lastAt=r.updated_at;
    out.set(r.course_slug,entry);
  }
  return out;
}

// Where to land when a student opens the course without choosing a lesson: the lesson they were last in,
// or, if they finished it, the next unfinished lesson after it; failing that, the lesson they most recently
// left half-done, then the first one they haven't finished.
export function resumeIndex(lessons:Lesson[],progress:Map<string,Progress>,canOpen:(l:Lesson)=>boolean){
  const latest=(keep:(p:Progress)=>boolean)=>{let found=-1,at='';lessons.forEach((l,i)=>{const p=progress.get(l.id);if(p&&canOpen(l)&&keep(p)&&p.updatedAt>at){found=i;at=p.updatedAt;}});return found;};
  const last=latest(()=>true);
  if(last<0)return Math.max(0,lessons.findIndex(canOpen));
  if(!progress.get(lessons[last].id)!.completed)return last;
  const unfinished=(l:Lesson)=>canOpen(l)&&!progress.get(l.id)?.completed;
  const next=lessons.findIndex((l,i)=>i>last&&unfinished(l));
  if(next>=0)return next;
  const started=latest(p=>!p.completed);
  if(started>=0)return started;
  const first=lessons.findIndex(unfinished);
  return first>=0?first:last;
}

// Seconds to resume a video from: nothing if it was finished or barely started, or near the end.
export function resumeAt(p:Progress|undefined){
  if(!p||p.completed||p.positionS<15)return 0;
  if(p.durationS&&p.positionS>p.durationS-15)return 0;
  return p.positionS;
}
export const clock=(s:number)=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(sec).padStart(2,'0');};
