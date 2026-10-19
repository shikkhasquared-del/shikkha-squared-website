import { safeNext } from '../../lib/student-auth';
import { loginPage } from '../../lib/student-pages';
import { currentStudent, googleConfig, redirect, failureMessage } from '../../lib/student-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const next=safeNext(new URL(request.url).searchParams.get('next'));
  try{if(await currentStudent(request))return redirect(next);return loginPage({next,google:!!googleConfig(request)});}
  catch(e){return loginPage({next,google:false,...failureMessage(e)});}
}
