import { AuthFailure, base64url, randomToken } from './student-auth';

// Google sign-in (OpenID Connect authorization-code flow with PKCE).
// The ID token comes straight from Google's token endpoint over TLS in exchange for our client
// secret, so its claims are checked here without a separate signature download (OIDC Core 3.1.3.7).
const AUTHORIZE='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN='https://oauth2.googleapis.com/token';
export const OAUTH_COOKIE='ss_oauth';
export type GoogleConfig={clientId:string;clientSecret:string;redirectUri:string};
export type OAuthState={state:string;nonce:string;verifier:string;next:string};

export async function startGoogle(config:GoogleConfig,next:string){
  const pending:OAuthState={state:randomToken(),nonce:randomToken(),verifier:randomToken(48),next};
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pending.verifier))));
  const url=new URL(AUTHORIZE);
  for(const [k,v] of Object.entries({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:'openid email profile',state:pending.state,nonce:pending.nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}))url.searchParams.set(k,v);
  return {url:url.toString(),cookieValue:base64url(new TextEncoder().encode(JSON.stringify(pending)))};
}

export function readPending(value:string|null):OAuthState|null {
  if(!value)return null;
  try{const json=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));return typeof json?.state==='string'&&typeof json?.nonce==='string'&&typeof json?.verifier==='string'?json:null;}catch{return null;}
}

export function checkIdToken(idToken:string,config:GoogleConfig,nonce:string,now=Date.now()){
  let claims:any;
  try{claims=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(idToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));}catch{throw new AuthFailure('Google sign-in failed. Try again.',502);}
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==config.clientId||!(claims.exp*1000>now)||claims.nonce!==nonce||typeof claims.sub!=='string')throw new AuthFailure('Google sign-in could not be verified. Try again.',401);
  return {sub:claims.sub as string,email:claims.email_verified===true&&typeof claims.email==='string'?claims.email.toLowerCase():null,name:typeof claims.name==='string'?claims.name:''};
}

export async function finishGoogle(config:GoogleConfig,pending:OAuthState,params:URLSearchParams){
  if(params.get('error'))throw new AuthFailure('Google sign-in was cancelled.',400);
  const code=params.get('code');
  if(!code||params.get('state')!==pending.state)throw new AuthFailure('Google sign-in expired. Try again.',400);
  const response=await fetch(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.redirectUri,grant_type:'authorization_code',code_verifier:pending.verifier}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new AuthFailure('Google sign-in failed. Try again.',502);
  const data=await response.json() as any;
  if(typeof data.id_token!=='string')throw new AuthFailure('Google sign-in failed. Try again.',502);
  return checkIdToken(data.id_token,config,pending.nonce);
}
