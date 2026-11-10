import { db } from './db';
import { records } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { courseLessons, type Lesson } from './lessons';
import { enrolmentFor, type CheckoutCourse } from './payments';
import { progressFor, type Progress } from './progress';
import { currentStudent } from './student-server';
import type { Student } from './student-auth';

// Who may open which lesson. Lessons live in the admin's course record (same database), including
// the private video links that the public catalogue never exposes.
type ClassroomCourse=Pick<CheckoutCourse,'title'|'format'|'board'|'teacher'|'checkout'|'priceMinor'>&{slug?:string;lessons?:unknown};
export type Classroom={slug:string;course:ClassroomCourse;published:boolean;lessons:Lesson[];student:Student|null;enrolled:boolean;access:{active:boolean;expiresAt:string|null}|null;progress:Map<string,Progress>};

export async function loadClassroom(request:Request,slug:string,{withProgress=false}={}):Promise<Classroom|null>{
  const row = await db.select({ data: records.data, status: records.status })
    .from(records)
    .where(and(eq(records.kind, 'course'), eq(records.uniqueKey, slug), isNull(records.archivedAt)))
    .limit(1);

  if(!row[0]) return null;

  const course = JSON.parse(row[0].data) as ClassroomCourse;
  const student = await currentStudent(request).catch(()=>null);
  const enrolment = student ? await enrolmentFor(student.id, slug) : null;
  const access = enrolment ? {active: enrolment.active, expiresAt: enrolment.expiresAt ? enrolment.expiresAt.toISOString() : null} : null;
  const enrolled = !!access?.active;
  const published = row[0].status === 'published';

  // Enrolled students keep access if a course is later unpublished; everyone else needs it published.
  if(!published && !enrolled) return null;

  const progress = withProgress && student ? await progressFor(student.id, slug) : new Map<string,Progress>();
  return {slug, course, published, lessons: courseLessons(course), student, enrolled, access, progress};
}

// The private referrer Tenbyte's access rule allows (a host name).
export const tenbyteReferrer = () => process.env.TENBYTE_REFERRER || undefined;

// Tenbyte's locations disagree on how the referrer must be written: some accept only the bare host name, others
// only a full address. Use the form that last worked here, and on a refusal try the other one.
let referrerForm = 0;
export async function fetchFromTenbyte(url:string,headers:Headers,timeoutMs:number){
  const host = tenbyteReferrer();
  // Never forward the private CDN referrer across an upstream redirect.
  const request = () => fetch(url, {headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs)});
  if(!host) return request();
  const forms = [host, `https://${host}/`];
  let response: Response | undefined;
  for(let attempt = 0; attempt < forms.length; attempt++){
    const form = (referrerForm + attempt) % forms.length;
    headers.set('referer', forms[form]);
    response = await request();
    if(response.status !== 403) { referrerForm = form; return response; }
    if(attempt < forms.length - 1) await response.body?.cancel();
  }
  return response!; // response is always assigned in the loop above
}
export const tenbyteHosts = () => (process.env.TENBYTE_HOSTS || '.tenbytecdn.com').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
