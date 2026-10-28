import { AuthFailure, isSameOrigin, updateStudentName } from '../../lib/student-auth';
import { accountPage, loginPage } from '../../lib/student-pages';
import { currentStudent, failureMessage, formInput, googleConfig, redirect, studentDb } from '../../lib/student-server';
import { enrolmentsFor } from '../../lib/payments';
import { courseProgressFor } from '../../lib/progress';
export const dynamic='force-dynamic';
const notices:Record<string,string>={name:'Your name has been saved.',phone:'Your mobile number has been added.',google:'Your Google account is now connected.',enrolled:'You are already enrolled in that course.'};
export async function GET(request:Request){
  try{
    const student=await currentStudent(request);
    if(!student)return redirect('/login?next=/account');
    const db=studentDb();
    const [courses,progress]=await Promise.all([enrolmentsFor(db,student.id),courseProgressFor(db,student.id).catch(()=>new Map())]);
    return accountPage(student,{google:!!googleConfig(request),courses,progress,notice:notices[new URL(request.url).searchParams.get('notice')||'']});
  }catch(e){return loginPage({next:'/account',google:false,...failureMessage(e)});}
}
export async function POST(request:Request){
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirect('/login?next=/account');
  try{
    if(!isSameOrigin(request))throw new AuthFailure('Use the form on this page.',403);
    const field=await formInput(request);
    await updateStudentName(studentDb(),student,field('name'));
    return redirect('/account?notice=name');
  }catch(e){return accountPage(student,{google:!!googleConfig(request),...failureMessage(e)});}
}
