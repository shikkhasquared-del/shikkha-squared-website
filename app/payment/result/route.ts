import { enrolmentFor, orderById, refreshPendingOrder } from '../../../lib/payments';
import { paymentResultPage } from '../../../lib/student-pages';
import { currentStudent, gatewayConfig, redirect, studentDb } from '../../../lib/student-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const id=new URL(request.url).searchParams.get('order')||'';
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirect('/login?next='+encodeURIComponent('/payment/result?order='+id));
  const db=studentDb();
  let order=/^[0-9a-f-]{36}$/.test(id)?await orderById(db,id):null;
  if(!order||order.studentId!==student.id)return redirect('/account');
  const config=gatewayConfig();
  if(config)order=await refreshPendingOrder(db,config,order).catch(()=>order!);
  const enrolment=order.status==='paid'?await enrolmentFor(db,student.id,order.courseSlug):null;
  return paymentResultPage(order,enrolment?{active:enrolment.active,expiresAt:enrolment.expires_at}:null);
}
