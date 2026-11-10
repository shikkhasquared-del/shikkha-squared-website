import { readRequestBody, RequestBodyTooLarge } from '../../../lib/request-body';
import { getCatalogue } from '../../../lib/catalog-pages';
import { AI_TIMEOUT_MS, ChatRefusal, MAX_REPLY_TOKENS, MODEL, cleanMessages, cleanReply, systemPrompt, takeChatTurn, whatsappLink } from '../../../lib/chat';
import { isSameOrigin } from '../../../lib/student-auth';
import { clientIp, otpPepper } from '../../../lib/student-server';
export const dynamic='force-dynamic';

const answer=(body:object,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const busy='Our assistant is taking a break right now. Please message our team on WhatsApp and they will help you.';

// POST /api/chat with { messages: [{ role, content }] }. Questions are answered and not stored.
export async function POST(request:Request){
  if(!isSameOrigin(request)||!(request.headers.get('content-type')||'').includes('application/json'))return answer({error:'Use the chat on this site.'},403);
  let messages;
  try{messages=cleanMessages((JSON.parse(new TextDecoder().decode(await readRequestBody(request,32*1024))) as {messages?:unknown}|null)?.messages);}
  catch(e){if(e instanceof RequestBodyTooLarge)return answer({error:'That message is too large.'},413);return answer({error:e instanceof ChatRefusal?e.message:'That message could not be read.'},400);}
  let whatsapp=whatsappLink(null);
  try{
    const data=await getCatalogue();
    whatsapp=whatsappLink(data.settings);
    const turn=await takeChatTurn(clientIp(request),otpPepper()||'shikkha');
    if(turn==='visitor')return answer({reply:'You have reached today\'s message limit. Please message our team on WhatsApp and they will help you.',handoff:true,whatsapp});
    if(turn==='site')return answer({reply:busy,handoff:true,whatsapp});
    // AI integration would go here (e.g., Vercel AI SDK or external API)
    return answer({reply:busy,handoff:true,whatsapp});
  }catch(e){
    console.error('Chat failed',e instanceof Error?e.message:'unknown');
    return answer({reply:busy,handoff:true,whatsapp});
  }
}