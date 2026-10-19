import { AuthFailure, isSameOrigin, issueLoginCode, normalizePhone, safeNext } from '../../../../lib/student-auth';
import { sendLoginCode } from '../../../../lib/sms';
import { accountPage, codePage, loginPage } from '../../../../lib/student-pages';
import { clientIp, currentStudent, failureMessage, formInput, googleConfig, otpPepper, studentDb } from '../../../../lib/student-server';
export const dynamic='force-dynamic';
// Sends a sign-in code, or (when signed in) a code to confirm a number being added to the account.
export async function POST(request:Request){
  const current=await currentStudent(request).catch(()=>null);
  let next='/account';
  try{
    if(!isSameOrigin(request))throw new AuthFailure('Use the sign-in form on this site.',403);
    const field=await formInput(request);next=safeNext(field('next'));
    const phone=normalizePhone(field('phone'));
    if(!phone)throw new AuthFailure('Enter a Bangladeshi mobile number, like 01712345678.');
    const code=await issueLoginCode(studentDb(),phone,clientIp(request),otpPepper());
    await sendLoginCode(phone,code);
    return codePage({phone,next});
  }catch(e){
    const failure=failureMessage(e),google=!!googleConfig(request);
    return current?accountPage(current,{google,...failure}):loginPage({next,google,...failure});
  }
}
