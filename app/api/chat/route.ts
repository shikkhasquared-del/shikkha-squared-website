import { env } from 'cloudflare:workers';
import { getCatalogue } from '../../../lib/catalog-pages';
import { ChatRefusal, MAX_REPLY_TOKENS, MODEL, cleanMessages, cleanReply, systemPrompt, takeChatTurn, whatsappLink } from '../../../lib/chat';
import { isSameOrigin } from '../../../lib/student-auth';
import { clientIp, otpPepper, studentDb } from '../../../lib/student-server';
export const dynamic='force-dynamic';

const answer=(body:object,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const busy='Our assistant is taking a break right now. Please message our team on WhatsApp and they will help you.';

// POST /api/chat with { messages: [{ role, content }] }. Questions are answered and not stored.
export async function POST(request:Request){
  if(!isSameOrigin(request)||!(request.headers.get('content-type')||'').includes('application/json'))return answer({error:'Use the chat on this site.'},403);
  let messages;
  try{messages=cleanMessages((JSON.parse((await request.text()).slice(0,12000)) as any)?.messages);}
  catch(e){return answer({error:e instanceof ChatRefusal?e.message:'That message could not be read.'},400);}
  let whatsapp=whatsappLink(null);
  try{
    const data=await getCatalogue();
    whatsapp=whatsappLink(data.settings);
    const turn=await takeChatTurn(studentDb(),clientIp(request),otpPepper()||'shikkha');
    if(turn==='visitor')return answer({reply:'You have reached today’s message limit. Please message our team on WhatsApp and they will help you.',handoff:true,whatsapp});
    if(turn==='site'||!env.AI)return answer({reply:busy,handoff:true,whatsapp});
    const reply=cleanReply(await env.AI.run(MODEL,{messages:[{role:'system',content:systemPrompt(data)},...messages],max_completion_tokens:MAX_REPLY_TOKENS,temperature:0.2,chat_template_kwargs:{enable_thinking:false}}));
    if(!reply)throw new Error('Empty reply');
    return answer({reply,whatsapp});
  }catch(e){
    console.error('Chat failed',e instanceof Error?e.message:'unknown');
    return answer({reply:busy,handoff:true,whatsapp});
  }
}
