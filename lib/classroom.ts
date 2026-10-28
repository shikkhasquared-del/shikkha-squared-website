import { env } from 'cloudflare:workers';
import { courseLessons, type Lesson } from './lessons';
import { enrolmentFor } from './payments';
import { progressFor, type Progress } from './progress';
import { currentStudent, studentDb } from './student-server';
import type { Student } from './student-auth';

// Who may open which lesson. Lessons live in the admin's course record (same database), including
// the private video links that the public catalogue never exposes.
export type Classroom={slug:string;course:any;published:boolean;lessons:Lesson[];student:Student|null;enrolled:boolean;access:{active:boolean;expiresAt:string|null}|null;progress:Map<string,Progress>};

export async function loadClassroom(request:Request,slug:string,{withProgress=false}={}):Promise<Classroom|null>{
  const db=studentDb();
  const row=await db.prepare("SELECT data,status FROM records WHERE kind='course' AND unique_key=? AND archived_at IS NULL").bind(slug).first<{data:string;status:string}>();
  if(!row)return null;
  const course=JSON.parse(row.data);
  const student=await currentStudent(request).catch(()=>null);
  const enrolment=student?await enrolmentFor(db,student.id,slug):null;
  const access=enrolment?{active:enrolment.active,expiresAt:enrolment.expires_at}:null,enrolled=!!access?.active;
  const published=row.status==='published';
  // Enrolled students keep access if a course is later unpublished; everyone else needs it published.
  if(!published&&!enrolled)return null;
  const progress=withProgress&&student?await progressFor(db,student.id,slug):new Map<string,Progress>();
  return {slug,course,published,lessons:courseLessons(course),student,enrolled,access,progress};
}

// The private referrer Tenbyte's access rule allows (a host name).
export const tenbyteReferrer=()=>env.TENBYTE_REFERRER||undefined;

// Tenbyte's locations disagree on how the referrer must be written: some accept only the bare host name, others
// only a full address. Use the form that last worked here, and on a refusal try the other one.
let referrerForm=0;
export async function fetchFromTenbyte(url:string,headers:Headers,timeoutMs:number){
  const host=tenbyteReferrer();
  if(!host)return fetch(url,{headers,signal:AbortSignal.timeout(timeoutMs)});
  const forms=[host,`https://${host}/`];
  let response!:Response;
  for(let attempt=0;attempt<forms.length;attempt++){
    const form=(referrerForm+attempt)%forms.length;
    headers.set('referer',forms[form]);
    response=await fetch(url,{headers,signal:AbortSignal.timeout(timeoutMs)});
    if(response.status!==403){referrerForm=form;return response;}
    if(attempt<forms.length-1)await response.body?.cancel();
  }
  return response;
}
export const tenbyteHosts=()=>(env.TENBYTE_HOSTS||'.tenbytecdn.com').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
