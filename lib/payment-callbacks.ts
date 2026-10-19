import { closeOrder, orderByTranId, settleOrder } from './payments';
import { failureMessage, formInput, gatewayConfig, redirect, studentDb } from './student-server';

// SSLCommerz returns the student to these addresses with a form POST from its own site, so they
// can't use same-origin checks or the session cookie. They only report back: every decision is
// made from SSLCommerz's validation API (settleOrder) or limited to closing a still-pending order.
export async function paymentReturn(request:Request,outcome:'success'|'failed'|'cancelled'){
  let tranId='';
  try{
    const field=await formInput(request);tranId=field('tran_id');
    const db=studentDb(),config=gatewayConfig();
    if(outcome==='success'&&config&&field('val_id'))await settleOrder(db,config,tranId,field('val_id'));
    else if(outcome!=='success')await closeOrder(db,tranId,outcome);
  }catch(e){failureMessage(e);}
  const order=tranId?await orderByTranId(studentDb(),tranId).catch(()=>null):null;
  return redirect(order?'/payment/result?order='+encodeURIComponent(order.id):'/account');
}

// Server-to-server notification from SSLCommerz (IPN). Always answers 200 so it isn't retried
// forever for orders we can't match; genuine payments are confirmed through the validation API.
export async function paymentNotification(request:Request){
  try{
    const field=await formInput(request);
    const db=studentDb(),config=gatewayConfig(),tranId=field('tran_id'),status=field('status');
    if(config&&tranId&&status==='VALID'&&field('val_id'))await settleOrder(db,config,tranId,field('val_id'));
    else if(tranId&&(status==='FAILED'||status==='CANCELLED'||status==='EXPIRED'))await closeOrder(db,tranId,status==='CANCELLED'?'cancelled':'failed');
  }catch(e){failureMessage(e);}
  return new Response('OK',{headers:{'content-type':'text/plain','cache-control':'no-store'}});
}
