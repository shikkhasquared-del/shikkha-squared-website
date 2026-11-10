import { enrolmentFor, orderById, refreshPendingOrder } from '../../../lib/payments';
import { paymentResultPage } from '../../../lib/student-pages';
import { currentStudent, gatewayConfig, redirectResponse } from '../../../lib/student-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const id=new URL(request.url).searchParams.get('order')||'';
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirectResponse('/login?next='+encodeURIComponent('/payment/result?order='+id));
  let order=/^[0-9a-f-]{36}$/.test(id)?await orderById(id):null;
  if(!order||order.studentId!==student.id)return redirectResponse('/account');
  const config=gatewayConfig();
  if(config)order=await refreshPendingOrder(config,order).catch(()=>order!);
  const enrolment=order.status==='paid'?await enrolmentFor(student.id,order.courseSlug):null;
  return paymentResultPage(order,enrolment?{active:enrolment.active,expiresAt:enrolment.expiresAt ? enrolment.expiresAt.toISOString() : null}:null);
}
