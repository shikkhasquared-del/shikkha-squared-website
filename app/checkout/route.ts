import { getCatalogue, unavailablePage } from '../../lib/catalog-pages';
import { AuthFailure, isSameOrigin } from '../../lib/student-auth';
import { PaymentFailure, checkoutContact, createOrder, enrolmentFor, mayBuy, purchasable, startPayment } from '../../lib/payments';
import { checkoutPage, loginPage } from '../../lib/student-pages';
import { findDiscount, normalizeCode } from '../../lib/discounts';
import { currentStudent, failureMessage, formInput, gatewayConfig, redirect, siteOrigin, studentDb } from '../../lib/student-server';
export const dynamic='force-dynamic';

async function sellableCourse(slug:string){
  const course=(await getCatalogue()).courses.find(c=>c.id===slug);
  if(!purchasable(course))throw new PaymentFailure('This course is not available to buy online. Contact admissions to enrol.',404);
  return course;
}

export async function GET(request:Request){
  const params=new URL(request.url).searchParams,slug=params.get('course')||'',code=normalizeCode(params.get('code'));
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirect('/login?next='+encodeURIComponent('/checkout?course='+slug));
  let course;
  try{course=await sellableCourse(slug);}catch(e){return e instanceof PaymentFailure?loginPage({next:'/courses',google:false,error:e.message,status:e.status}):unavailablePage();}
  if(!await mayBuy(studentDb(),student.id,course.id))return redirect('/account?notice=enrolled');
  const current=await enrolmentFor(studentDb(),student.id,course.id);
  const renewing=current?{active:current.active,expiresAt:current.expires_at}:null;
  let discount=null,codeError:string|undefined;
  if(code){try{discount=await findDiscount(studentDb(),code,course.id);}catch(e){if(!(e instanceof PaymentFailure))throw e;codeError=e.message;}}
  return checkoutPage(student,course,{renewing,discount,code,codeError,...(gatewayConfig()?{}:{error:'Online payment is not set up yet. Contact admissions to enrol.',status:503})});
}

export async function POST(request:Request){
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirect('/login?next=/courses');
  let course:any=null,email='',phone='',code='';
  try{
    if(!isSameOrigin(request))throw new AuthFailure('Use the checkout form on this site.',403);
    const field=await formInput(request);email=field('email');phone=field('phone');code=normalizeCode(field('code'));
    course=await sellableCourse(field('course'));
    const config=gatewayConfig();
    if(!config)throw new PaymentFailure('Online payment is not set up yet. Contact admissions to enrol.',503);
    const db=studentDb();
    if(!await mayBuy(db,student.id,course.id))return redirect('/account?notice=enrolled');
    // The code is checked again here: it may have expired or run out since the student applied it.
    const discount=code?await findDiscount(db,code,course.id):null;
    const order=await createOrder(db,student,course,checkoutContact(student,{email,phone}),Date.now(),discount);
    try{return redirect(await startPayment(config,order,student,siteOrigin(request)));}
    catch(e){await db.prepare("UPDATE orders SET status='failed',note=? WHERE id=? AND status='pending'").bind('Could not start payment',order.id).run();throw e;}
  }catch(e){
    const failure=failureMessage(e);
    return course?checkoutPage(student,course,{email,phone,code,...failure}):loginPage({next:'/courses',google:false,...failure});
  }
}
