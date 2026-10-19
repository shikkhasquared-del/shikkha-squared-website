import { getCatalogue, unavailablePage } from '../../lib/catalog-pages';
import { AuthFailure, isSameOrigin } from '../../lib/student-auth';
import { PaymentFailure, checkoutContact, createOrder, isEnrolled, purchasable, startPayment } from '../../lib/payments';
import { checkoutPage, loginPage } from '../../lib/student-pages';
import { currentStudent, failureMessage, formInput, gatewayConfig, redirect, siteOrigin, studentDb } from '../../lib/student-server';
export const dynamic='force-dynamic';

async function sellableCourse(slug:string){
  const course=(await getCatalogue()).courses.find(c=>c.id===slug);
  if(!purchasable(course))throw new PaymentFailure('This course is not available to buy online. Contact admissions to enrol.',404);
  return course;
}

export async function GET(request:Request){
  const slug=new URL(request.url).searchParams.get('course')||'';
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirect('/login?next='+encodeURIComponent('/checkout?course='+slug));
  let course;
  try{course=await sellableCourse(slug);}catch(e){return e instanceof PaymentFailure?loginPage({next:'/courses',google:false,error:e.message,status:e.status}):unavailablePage();}
  if(await isEnrolled(studentDb(),student.id,course.id))return redirect('/account?notice=enrolled');
  return checkoutPage(student,course,gatewayConfig()?{}:{error:'Online payment is not set up yet. Contact admissions to enrol.',status:503});
}

export async function POST(request:Request){
  const student=await currentStudent(request).catch(()=>null);
  if(!student)return redirect('/login?next=/courses');
  let course:any=null,email='',phone='';
  try{
    if(!isSameOrigin(request))throw new AuthFailure('Use the checkout form on this site.',403);
    const field=await formInput(request);email=field('email');phone=field('phone');
    course=await sellableCourse(field('course'));
    const config=gatewayConfig();
    if(!config)throw new PaymentFailure('Online payment is not set up yet. Contact admissions to enrol.',503);
    const db=studentDb();
    if(await isEnrolled(db,student.id,course.id))return redirect('/account?notice=enrolled');
    const order=await createOrder(db,student,course,checkoutContact(student,{email,phone}));
    try{return redirect(await startPayment(config,order,student,siteOrigin(request)));}
    catch(e){await db.prepare("UPDATE orders SET status='failed',note=? WHERE id=? AND status='pending'").bind('Could not start payment',order.id).run();throw e;}
  }catch(e){
    const failure=failureMessage(e);
    return course?checkoutPage(student,course,{email,phone,...failure}):loginPage({next:'/courses',google:false,...failure});
  }
}
