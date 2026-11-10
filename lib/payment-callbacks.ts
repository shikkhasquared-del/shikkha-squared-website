import { closeOrder, orderByTranId, settleOrder } from './payments';
import { failureMessage, formInput, gatewayConfig, redirectResponse } from './student-server';

// SSLCommerz returns the student to these addresses with a form POST from its own site, so they
// can't use same-origin checks or the session cookie. They only report back: every decision is
// made from SSLCommerz's validation API (settleOrder) or limited to closing a still-pending order.
export async function paymentReturn(request:Request,outcome:'success'|'failed'|'cancelled'){
  let tranId='';
  try{
    const field=await formInput(request);tranId=field('tran_id');
    const config=gatewayConfig();
    if(outcome==='success'&&config&&field('val_id'))await settleOrder(config,tranId,field('val_id'));
    else if(outcome!=='success')await closeOrder(tranId,outcome);
  }catch(e){failureMessage(e);}
  const order=tranId?await orderByTranId(tranId).catch(()=>null):null;
  return redirectResponse(order?'/payment/result?order='+encodeURIComponent(order.id):'/account');
}

// Server-to-server notification from SSLCommerz (IPN). Acknowledge processed and invalid
// notifications, but signal a temporary failure when verification or settlement is unavailable.
export async function paymentNotification(request:Request){
  try{
    const field=await formInput(request);
    const config=gatewayConfig(),tranId=field('tran_id'),status=field('status');
    if(config&&tranId&&status==='VALID'&&field('val_id'))await settleOrder(config,tranId,field('val_id'));
    else if(tranId&&(status==='FAILED'||status==='CANCELLED'||status==='EXPIRED'))await closeOrder(tranId,status==='CANCELLED'?'cancelled':'failed');
  }catch(e){
    const {status}=failureMessage(e);
    if(status===413)return new Response('Request too large.',{status:413,headers:{'cache-control':'no-store'}});
    if(status>=500)return new Response('Payment confirmation is temporarily unavailable.',{
      status:503,headers:{'content-type':'text/plain','cache-control':'no-store','retry-after':'30'},
    });
  }
  return new Response('OK',{headers:{'content-type':'text/plain','cache-control':'no-store'}});
}
