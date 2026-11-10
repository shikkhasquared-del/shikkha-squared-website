import { db } from './db';
import { lessonProgress, records } from '../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Lesson, LessonInput } from './lessons';

// Lesson progress: where each student stopped in each lesson, and which lessons they have finished.
// Videos count as finished once 90% has been watched; other lessons when the student marks them done.

export const DONE_SHARE=0.9;
export type Progress={positionS:number;durationS:number;completed:boolean;updatedAt:string};
export type CourseProgress={done:number;total:number;lastAt:string|null};
type ProgressRow={lessonId:string;positionS:number;durationS:number;completedAt:string|null;updatedAt:string};
type CourseProgressRow={courseSlug:string;lessonId:string;completedAt:string|null;updatedAt:string;data:string|null};

const whole=(value:unknown,max:number)=>{const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?Math.min(n,max):0;};

export async function recordProgress(studentId:string,courseSlug:string,lessonId:string,input:{position?:unknown;duration?:unknown;done?:unknown},now=Date.now()){
  const durationS=whole(input.duration,24*60*60),positionS=Math.min(whole(input.position,24*60*60),durationS||24*60*60);
  const done=input.done===true||(durationS>0&&positionS>=durationS*DONE_SHARE);
  const nowDate = new Date(now);

  await db.insert(lessonProgress).values({
    studentId,
    courseSlug,
    lessonId,
    positionS,
    durationS,
    completedAt: done ? nowDate : null,
    updatedAt: nowDate,
  }).onConflictDoUpdate({
    target: [lessonProgress.studentId, lessonProgress.courseSlug, lessonProgress.lessonId],
    set: {
      positionS: sql`excluded.position_s`,
      durationS: sql`greatest(${lessonProgress.durationS}, excluded.duration_s)`,
      completedAt: sql`coalesce(${lessonProgress.completedAt}, excluded.completed_at)`,
      updatedAt: nowDate,
    },
  });
}

export async function progressFor(studentId:string,courseSlug:string){
  const rows = await db.select({
    lessonId: lessonProgress.lessonId,
    positionS: lessonProgress.positionS,
    durationS: lessonProgress.durationS,
    completedAt: lessonProgress.completedAt,
    updatedAt: lessonProgress.updatedAt,
  }).from(lessonProgress)
  .where(and(eq(lessonProgress.studentId, studentId), eq(lessonProgress.courseSlug, courseSlug)));

  return new Map<string,Progress>(rows.map(r=>[r.lessonId,{
    positionS: r.positionS,
    durationS: r.durationS,
    completed: !!r.completedAt,
    updatedAt: r.updatedAt.toISOString(),
  }]));
}

// Finished lessons out of the course's current lessons, for every course the student has started.
export async function courseProgressFor(studentId:string){
  const rows = await db.select({
    courseSlug: lessonProgress.courseSlug,
    lessonId: lessonProgress.lessonId,
    completedAt: lessonProgress.completedAt,
    updatedAt: lessonProgress.updatedAt,
    data: records.data,
  }).from(lessonProgress)
  .leftJoin(records, and(
    eq(records.kind, 'course'),
    eq(records.uniqueKey, lessonProgress.courseSlug),
    isNull(records.archivedAt)
  ))
  .where(eq(lessonProgress.studentId, studentId));

  const out = new Map<string,CourseProgress>();
  const lessonIds = new Map<string,Set<string>>();

  for(const r of rows){
    if(!lessonIds.has(r.courseSlug)){
      let lessons:LessonInput[]=[];
      try{lessons=(JSON.parse(r.data||'{}') as {lessons?:LessonInput[]}).lessons||[];}catch{}
      lessonIds.set(r.courseSlug,new Set(lessons.map((l,i)=>String(l.id||'i'+i).slice(0,60))));
    }
    const ids = lessonIds.get(r.courseSlug)!;
    const entry = out.get(r.courseSlug)||{done:0,total:ids.size,lastAt:null};
    if(r.completedAt && ids.has(r.lessonId)) entry.done++;
    if(!entry.lastAt || r.updatedAt.getTime() > new Date(entry.lastAt).getTime()) entry.lastAt = r.updatedAt.toISOString();
    out.set(r.courseSlug, entry);
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
