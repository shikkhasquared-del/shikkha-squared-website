import { cookie, readCookie, safeNext, studentForGoogle } from '../../../../lib/student-auth';
import { OAUTH_COOKIE, finishGoogle, readPending } from '../../../../lib/google-auth';
import { accountPage, loginPage } from '../../../../lib/student-pages';
import { currentStudent, failureMessage, googleConfig, redirectResponse, signedIn } from '../../../../lib/student-server';
import { db } from '../../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const clear=cookie(request,OAUTH_COOKIE,'',{maxAge:0,path:'/auth/google'});
  const pending=readPending(readCookie(request,OAUTH_COOKIE)),config=googleConfig(request);
  const current=await currentStudent(request).catch(()=>null);
  try{
    if(!config)return loginPage({next:'/account',google:false,error:'Google sign-in is not set up yet.',status:503});
    if(!pending)return loginPage({next:'/account',google:true,error:'Google sign-in expired. Try again.',status:400});
    const identity=await finishGoogle(config,pending,new URL(request.url).searchParams);
    const student=await studentForGoogle(db,identity,current);
    if(current)return redirectResponse('/account?notice=google',[clear]);
    return signedIn(request,student.id,student.name?safeNext(pending.next):'/account',[clear]);
  }catch(e){
    const failure=failureMessage(e);
    const response=current?accountPage(current,{google:true,...failure}):loginPage({next:safeNext(pending?.next),google:true,...failure});
    response.headers.append('set-cookie',clear);return response;
  }
}
