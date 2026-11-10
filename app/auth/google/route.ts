import { safeNext, cookie } from '../../../lib/student-auth';
import { OAUTH_COOKIE, startGoogle } from '../../../lib/google-auth';
import { loginPage } from '../../../lib/student-pages';
import { googleConfig, redirectResponse } from '../../../lib/student-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const next=safeNext(new URL(request.url).searchParams.get('next'));
  const config=googleConfig(request);
  if(!config)return loginPage({next,google:false,error:'Google sign-in is not set up yet. Use your mobile number instead.',status:503});
  const {url,cookieValue}=await startGoogle(config,next);
  return redirectResponse(url,[cookie(request,OAUTH_COOKIE,cookieValue,{maxAge:600,path:'/auth/google'})]);
}
