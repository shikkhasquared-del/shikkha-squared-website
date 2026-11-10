import { AuthFailure } from './student-auth';

// Sends a sign-in code. SMS_PROVIDER="console" is for local development only: the code is
// printed in the dev server terminal instead of being sent. A real provider is added at launch.
export function requireSmsProvider(){
  if(process.env.NODE_ENV==='development'&&process.env.SMS_PROVIDER==='console')return;
  throw new AuthFailure('SMS sign-in is not available yet. Use Google sign-in or try again later.',503);
}

export async function sendLoginCode(phone:string,code:string){
  requireSmsProvider();
  console.log(`[dev SMS] Shikkha Squared code for ${phone}: ${code}`);
}
