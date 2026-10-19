import { SESSION_COOKIE, cookie, endSession, isSameOrigin, readCookie } from '../../../lib/student-auth';
import { redirect, studentDb } from '../../../lib/student-server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!isSameOrigin(request))return new Response('Use the sign-out button on this site.',{status:403});
  await endSession(studentDb(),readCookie(request,SESSION_COOKIE)).catch(()=>{});
  return redirect('/',[cookie(request,SESSION_COOKIE,'',{maxAge:0})]);
}
