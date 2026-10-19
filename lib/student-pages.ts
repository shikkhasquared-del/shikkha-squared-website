import { esc, shell, type Catalogue } from './catalog-pages';
import { displayPhone, type Student } from './student-auth';
import { taka, type Order } from './payments';

// Student sign-in and account pages, rendered inside the shared catalogue page shell.
const blank:Catalogue={courses:[],sections:[],instructors:[],settings:{},campaigns:[]};
const message=(error?:string,notice?:string)=>(error?`<p class="auth-message error" role="alert">${esc(error)}</p>`:'')+(notice?`<p class="auth-message" role="status">${esc(notice)}</p>`:'');
const page=(title:string,body:string,status=200)=>shell(blank,{title,description:'Sign in to your Shikkha Squared student account.',active:'account',page:'account',status,styles:['/student.css?v=2'],headers:{'x-frame-options':'DENY'},body:`<section class="catalog-container student-auth">${body}</section>`});
const googleIcon='<svg viewBox="0 0 24 24" aria-hidden="true" class="auth-google-mark"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>';
const hidden=(name:string,value:string)=>`<input type="hidden" name="${name}" value="${esc(value)}">`;
const phoneForm=(next:string,label='Send code')=>`<form class="auth-form" method="post" action="/auth/phone/start">${hidden('next',next)}<label for="phone">Mobile number</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" maxlength="20" required><button class="page-button" type="submit">${label}</button></form>`;
const googleButton=(enabled:boolean,next:string,label='Continue with Google')=>enabled?`<a class="page-button outline auth-google" href="/auth/google?next=${encodeURIComponent(next)}">${googleIcon}${label}</a>`:`<p class="auth-muted">Google sign-in is coming soon.</p>`;

export function loginPage({next,google,error,notice,status}:{next:string;google:boolean;error?:string;notice?:string;status?:number}){
  return page('Log in',`<div class="auth-card"><p class="page-eyebrow">STUDENT ACCOUNT</p><h1>Welcome to your classroom.</h1><p class="auth-lead">Sign in with your mobile number or Google. New here? Your account is created the first time you sign in.</p>${message(error,notice)}${phoneForm(next)}<div class="auth-or"><span>or</span></div>${googleButton(google,next)}</div>`,status);
}

export function codePage({phone,next,error,notice,status}:{phone:string;next:string;error?:string;notice?:string;status?:number}){
  return page('Enter your code',`<div class="auth-card"><p class="page-eyebrow">CHECK YOUR PHONE</p><h1>Enter your code.</h1><p class="auth-lead">We sent a 6-digit code to <strong>${esc(displayPhone(phone))}</strong>. It works for 5 minutes.</p>${message(error,notice)}<form class="auth-form" method="post" action="/auth/phone/verify">${hidden('phone',phone)}${hidden('next',next)}<label for="code">6-digit code</label><input id="code" name="code" class="auth-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus><button class="page-button" type="submit">Sign in</button></form><div class="auth-links"><form method="post" action="/auth/phone/start">${hidden('phone',phone)}${hidden('next',next)}<button class="auth-link-button" type="submit">Send a new code</button></form><a href="/login?next=${encodeURIComponent(next)}">Use a different number</a></div></div>`,status);
}

export function accountPage(student:Student,{google,error,notice,status,courses=[]}:{google:boolean;error?:string;notice?:string;status?:number;courses?:{course_slug:string;course_title:string}[]}){
  const named=!!student.name;
  const nameForm=`<form class="auth-form" method="post" action="/account"><label for="name">${named?'Your name':'What should we call you?'}</label><input id="name" name="name" autocomplete="name" maxlength="100" value="${esc(student.name)}" required ${named?'':'autofocus'}><button class="page-button ${named?'outline':''}" type="submit">${named?'Save name':'Continue'}</button></form>`;
  const phoneRow=student.phone?`<div class="auth-method"><span>Mobile number</span><strong>${esc(displayPhone(student.phone))}</strong></div>`:`<div class="auth-method"><span>Mobile number</span><p class="auth-muted">Add a number so you can sign in by SMS code.</p>${phoneForm('/account','Add number')}</div>`;
  const googleRow=student.googleSub?`<div class="auth-method"><span>Google</span><strong>${esc(student.email||'Connected')}</strong></div>`:`<div class="auth-method"><span>Google</span>${googleButton(google,'/account','Connect Google')}</div>`;
  return page('My account',`<div class="auth-card wide"><p class="page-eyebrow">STUDENT ACCOUNT</p><h1>${named?`Hello, ${esc(student.name.split(' ')[0])}.`:'Welcome to Shikkha Squared.'}</h1>${message(error,notice)}${nameForm}<h2>Sign-in methods</h2>${phoneRow}${googleRow}<h2>My courses</h2>${courses.length?`<ul class="auth-courses">${courses.map(c=>`<li><a href="/courses/${encodeURIComponent(c.course_slug)}">${esc(c.course_title)}</a></li>`).join('')}</ul>`:`<p class="auth-muted">Courses you buy will appear here. <a href="/courses">Browse courses</a></p>`}<form method="post" action="/auth/logout" class="auth-signout"><button class="auth-link-button" type="submit">Sign out</button></form></div>`,status);
}

export function checkoutPage(student:Student,course:any,{email,phone,error,status}:{email?:string;phone?:string;error?:string;status?:number}={}){
  const emailValue=email??student.email??'',phoneValue=phone??(student.phone?displayPhone(student.phone).replace('-',''):'');
  return page('Checkout',`<div class="auth-card"><p class="page-eyebrow">CHECKOUT</p><h1>${esc(course.title)}</h1><p class="auth-lead">${esc(course.board||'')}${course.teacher?' · '+esc(course.teacher):''}</p><div class="checkout-total"><span>Course fee</span><strong>${esc(taka(course.priceMinor))}</strong></div>${message(error)}<form class="auth-form" method="post" action="/checkout">${hidden('course',course.id)}<label for="email">Email for your receipt</label><input id="email" name="email" type="email" autocomplete="email" maxlength="100" value="${esc(emailValue)}" required><label for="phone">Mobile number</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" maxlength="20" value="${esc(phoneValue)}" required><button class="page-button" type="submit">Pay ${esc(taka(course.priceMinor))}</button></form><p class="auth-muted checkout-note">You'll pay on SSLCommerz's secure page with bKash, Nagad, Rocket, a card or internet banking. We never see your card or wallet details.</p><div class="auth-links"><a href="/courses/${encodeURIComponent(course.id)}">Back to the course</a></div></div>`,status);
}

const resultCopy:Record<string,{eyebrow:string;title:string;body:string}>={
  paid:{eyebrow:'PAYMENT CONFIRMED',title:'You’re enrolled.',body:'Your payment is confirmed and the course is now in your account.'},
  pending:{eyebrow:'CONFIRMING PAYMENT',title:'Almost there.',body:'We’re waiting for the payment service to confirm your payment. This usually takes a few seconds. Refresh this page in a moment.'},
  review:{eyebrow:'PAYMENT UNDER REVIEW',title:'Your payment is being checked.',body:'The payment service has held this payment for a routine security check. We’ll enrol you as soon as it clears. Contact us if you have any questions.'},
  failed:{eyebrow:'PAYMENT NOT COMPLETED',title:'The payment didn’t go through.',body:'No access was added. If money was taken from your account, contact us with the payment reference below.'},
  cancelled:{eyebrow:'PAYMENT CANCELLED',title:'You cancelled the payment.',body:'Nothing was charged. You can try again whenever you’re ready.'},
};
export function paymentResultPage(order:Order){
  const copy=resultCopy[order.status]||resultCopy.pending;
  const actions=order.status==='paid'?`<a class="page-button" href="/account">Go to my courses</a>`:order.status==='failed'||order.status==='cancelled'?`<a class="page-button" href="/checkout?course=${encodeURIComponent(order.courseSlug)}">Try again</a>`:order.status==='pending'?`<a class="page-button outline" href="/payment/result?order=${encodeURIComponent(order.id)}">Refresh</a>`:'';
  return page('Payment',`<div class="auth-card"><p class="page-eyebrow">${copy.eyebrow}</p><h1>${copy.title}</h1><p class="auth-lead">${copy.body}</p><div class="checkout-total"><span>${esc(order.courseTitle)}</span><strong>${esc(taka(order.amountMinor))}</strong></div><p class="auth-muted">Payment reference: <strong>${esc(order.tranId)}</strong></p>${actions}</div>`);
}
