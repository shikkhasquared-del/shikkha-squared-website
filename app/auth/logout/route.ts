import { SESSION_COOKIE, cookie, endSession, isSameOrigin, readCookie } from '../../../lib/student-auth';
import { redirectResponse } from '../../../lib/student-server';
import { db } from '../../../lib/db';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!isSameOrigin(request))return new Response('Use the sign-out button on this site.',{status:403});
  await endSession(db, readCookie(request,SESSION_COOKIE)).catch(()=>{});
  return redirectResponse('/',[cookie(request,SESSION_COOKIE,'',{maxAge:0})]);
}