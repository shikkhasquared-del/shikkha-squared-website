import { env } from 'cloudflare:workers';
import { AuthFailure } from './student-auth';

// Sends a sign-in code. SMS_PROVIDER="console" is for local development only: the code is
// printed in the dev server terminal instead of being sent. A real provider is added at launch.
export async function sendLoginCode(phone:string,code:string){
  if(env.SMS_PROVIDER==='console'){console.log(`[dev SMS] Shikkha Squared code for ${phone}: ${code}`);return;}
  throw new AuthFailure('SMS sign-in is not available yet. Use Google sign-in or try again later.',503);
}
