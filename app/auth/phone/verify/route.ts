import { AuthFailure, consumeLoginCode, isSameOrigin, normalizePhone, safeNext, studentForPhone } from '../../../../lib/student-auth';
import { codePage, loginPage } from '../../../../lib/student-pages';
import { currentStudent, failureMessage, formInput, googleConfig, otpPepper, redirect, signedIn, studentDb } from '../../../../lib/student-server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  let phone:string|null=null,next='/account';
  try{
    if(!isSameOrigin(request))throw new AuthFailure('Use the sign-in form on this site.',403);
    const field=await formInput(request);next=safeNext(field('next'));phone=normalizePhone(field('phone'));
    if(!phone)throw new AuthFailure('Enter your mobile number again.');
    const db=studentDb();
    await consumeLoginCode(db,phone,field('code').trim(),otpPepper());
    const current=await currentStudent(request);
    const student=await studentForPhone(db,phone,current);
    if(current)return redirect('/account?notice=phone');
    return signedIn(request,student.id,student.name?next:'/account');
  }catch(e){
    const failure=failureMessage(e);
    return phone?codePage({phone,next,...failure}):loginPage({next,google:!!googleConfig(request),...failure});
  }
}
