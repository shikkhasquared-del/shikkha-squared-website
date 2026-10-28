import { esc, shell, type Catalogue } from './catalog-pages';

// Privacy Policy and Terms of Use. The text describes what this site actually collects and which
// services it uses; keep it in step with the code when that changes.
// While LEGAL_DRAFT is true, both pages say they are drafts under review.
export const LEGAL_DRAFT=true;
export const LEGAL_UPDATED='28 October 2026';

type Contact={email:string;phone:string;address:string};
export function legalContact(settings:any):Contact{
  return {email:settings?.supportEmail||'shikkhasquared@gmail.com',phone:settings?.supportPhone||'',address:settings?.address||''};
}
const contactBlock=(c:Contact)=>`<ul class="legal-contact"><li>Email: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>${c.phone?`<li>Phone: ${esc(c.phone)}</li>`:''}${c.address?`<li>Address: ${esc(c.address)}</li>`:''}</ul>`;
const draft=()=>LEGAL_DRAFT?`<p class="legal-draft" role="note"><strong>Draft — under review.</strong> This page is being reviewed by Shikkha Squared and may change before launch.</p>`:'';

function page(data:Catalogue,title:string,description:string,body:string){
  return shell(data,{title,description,active:'',page:'legal',path:title==='Privacy Policy'?'/privacy':'/terms',styles:['/legal.css?v=1'],body:`<article class="catalog-container legal"><p class="page-eyebrow">SHIKKHA SQUARED</p><h1>${esc(title)}</h1><p class="legal-updated">Last updated: ${LEGAL_UPDATED}</p>${draft()}${body}</article>`});
}

export function privacyPage(data:Catalogue){
  const c=legalContact(data.settings);
  return page(data,'Privacy Policy','How Shikkha Squared collects, uses and protects your information.',`
<p>This policy explains what information Shikkha Squared ("we", "us") collects when you use this website, why we collect it, who we share it with, and the choices you have. We collect only what we need to run your account, your courses and your payments.</p>

<h2>1. Information we collect</h2>
<h3>When you create an account or sign in</h3>
<ul>
<li><strong>Your name</strong>, which you enter on your account page.</li>
<li><strong>Your mobile number</strong>, if you sign in with a code sent by SMS. We keep the codes themselves only in scrambled (hashed) form and delete them after 24 hours.</li>
<li><strong>Your email address and Google account identifier</strong>, if you sign in with Google. Google shares only your name, email address and a stable account ID with us; we never see your Google password.</li>
<li><strong>Your network (IP) address</strong> when you request a sign-in code, kept for up to 24 hours to stop abuse such as repeated code requests.</li>
</ul>
<h3>When you buy a course</h3>
<ul>
<li>The course, the price, the date, your email address and mobile number for the receipt, and the payment reference.</li>
<li>From our payment provider, SSLCommerz: whether the payment succeeded, the payment method type (for example bKash or a card network) and the bank's transaction reference.</li>
<li>We <strong>never</strong> receive or store your card number, PIN, wallet password or one-time passwords. You enter those only on SSLCommerz's secure payment page.</li>
</ul>
<h3>When you study</h3>
<ul>
<li>Which courses you are enrolled in and how you got access (online payment, or added by our team, for example after a cash payment or a scholarship).</li>
<li>When you watch a lesson, your browser requests the video through this website and our video delivery network. Like any website, these services see your IP address and browser type when you connect. While you watch, the player shows your name and mobile number or email on top of the video, to discourage copying; this is shown only on your own screen.</li>
<li>Which lessons you have finished and where you stopped in each video, so you can carry on where you left off.</li>
<li>To protect your account and our courses from sharing, we note each time you sign in or start a lesson video: the date and time, your approximate city and country (as reported by our hosting provider), the type of device (for example "iPhone" or "Windows") and a scrambled, one-way code made from your network address. We never store the address itself. Our team uses this only to spot accounts that seem to be shared.</li>
</ul>
<h3>Stored on your own device</h3>
<ul>
<li><strong>Sign-in cookie</strong> (<code>ss_session</code>): keeps you signed in for up to 30 days, or until you sign out.</li>
<li><strong>Google sign-in cookie</strong> (<code>ss_oauth</code>): used for up to 10 minutes while you sign in with Google.</li>
<li><strong>Saved courses and motion setting</strong>: the homepage remembers the courses you bookmark and whether you turned animations off, in your browser's local storage. This stays on your device and is not sent to us.</li>
</ul>
<p>We do not use advertising cookies, and we do not use analytics or tracking tools that follow you across other websites.</p>

<h2>2. How we use your information</h2>
<ul>
<li>To create your account, sign you in and keep your account secure.</li>
<li>To process course payments, give you access to the courses you buy and send payment receipts.</li>
<li>To answer your questions and provide support.</li>
<li>To keep records of payments, as required for accounting and by law.</li>
<li>To protect the website and our students from fraud and abuse.</li>
</ul>
<p>We do not sell your personal information, and we do not use it for advertising.</p>

<h2>3. Who we share it with</h2>
<p>We use trusted service providers who process information on our behalf, only as needed to run the website:</p>
<ul>
<li><strong>Cloudflare</strong>: hosts this website and its database.</li>
<li><strong>Google</strong>: provides "Continue with Google" sign-in, if you choose it.</li>
<li><strong>SSLCommerz</strong>: processes course payments.</li>
<li><strong>Tenbyte</strong>: stores and delivers lesson videos.</li>
<li><strong>jsDelivr</strong>: delivers the video player software to your browser.</li>
<li><strong>An SMS provider</strong>: sends sign-in codes to your phone, when SMS sign-in is available.</li>
</ul>
<p>Our team members who need it for their work (for example to confirm a payment or give you course access) can see your account details in our administration system. We may also share information if the law requires it, or to protect our students, staff or website from harm.</p>

<h2>4. How long we keep it</h2>
<ul>
<li>Sign-in codes and the related network addresses: 24 hours.</li>
<li>Sign-in sessions: up to 30 days, or until you sign out.</li>
<li>Sign-in and lesson-start records used to spot account sharing: 90 days.</li>
<li>Your account and course access: for as long as you have an account.</li>
<li>Payment records: for as long as accounting and tax laws require, even if you close your account.</li>
</ul>

<h2>5. Your choices and rights</h2>
<p>You can see and change your name and sign-in methods on your account page at any time. You can also ask us to:</p>
<ul>
<li>give you a copy of the personal information we hold about you;</li>
<li>correct information that is wrong;</li>
<li>delete your account and personal information, except records we must keep by law, such as payment records.</li>
</ul>
<p>To make a request, contact us using the details below. We may need to confirm your identity first.</p>

<h2>6. Students under 18</h2>
<p>Many of our students are under 18. If you are under 18, please make sure a parent or guardian knows you are using Shikkha Squared, and ask them to make course payments or approve them. Parents and guardians can contact us about their child's information at any time.</p>

<h2>7. Keeping your information safe</h2>
<p>We protect your information with encrypted (HTTPS) connections, sign-in codes and session keys that are stored only in scrambled form, limited staff access, and payment handling by SSLCommerz rather than on our own systems. No system is completely secure, so please keep your phone and email account safe and tell us straight away if you notice anything unusual on your account.</p>

<h2>8. Changes to this policy</h2>
<p>If we make important changes, we will update this page and the date at the top, and tell you on the website or by email where appropriate.</p>

<h2>9. Contact us</h2>
${contactBlock(c)}
`);
}

export function termsPage(data:Catalogue){
  const c=legalContact(data.settings);
  return page(data,'Terms of Use','The terms for using Shikkha Squared and its courses.',`
<p>These terms apply when you use the Shikkha Squared website, create an account or buy a course. By using the website, you agree to them. Please also read our <a href="/privacy">Privacy Policy</a>.</p>

<h2>1. Who we are</h2>
<p>Shikkha Squared provides online learning for O Level, AS and A Level students. You can contact us using the details at the end of this page.</p>

<h2>2. Your account</h2>
<ul>
<li>Your account is for you alone. Please do not share your sign-in details, codes or account with anyone.</li>
<li>Your account can be signed in on up to 2 devices at a time. Signing in on another device signs out the one that signed in earliest.</li>
<li>Give accurate information, and keep your mobile number and email up to date so you can always sign in.</li>
<li>If you are under 18, a parent or guardian should know you are using Shikkha Squared and approve any purchases.</li>
<li>Tell us straight away if you think someone else has used your account.</li>
</ul>

<h2>3. Buying a course</h2>
<ul>
<li>Prices are shown in Bangladeshi Taka (BDT) on each course page and at checkout.</li>
<li>Payments are processed securely by SSLCommerz. You can pay with bKash, Nagad, Rocket, cards or internet banking, as offered on the payment page.</li>
<li>Your access starts as soon as your payment is confirmed. Payments flagged by the payment provider's security checks may be held until they are cleared.</li>
<li>How long your access lasts depends on the type of course:
<ul>
<li><strong>Crash courses:</strong> lifetime access, for as long as the course is offered on Shikkha Squared.</li>
<li><strong>All other courses:</strong> one month from the date your payment is confirmed.</li>
</ul></li>
<li>You can renew a monthly course by paying again, from 7 days before your access ends. If you renew before it ends, the extra month starts when your current access ends, so you don't lose any days.</li>
</ul>

<h2>4. Refunds</h2>
<p>We don't offer automatic refunds. If you believe you should receive a refund, email us at <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> with your payment reference and the reason. We review each request individually and will let you know our decision.</p>
<p>If a payment is taken but your course access does not appear, email us with your payment reference and we will sort it out.</p>

<h2>5. Using course content</h2>
<ul>
<li>Courses, videos, notes and other materials are for your own personal study only.</li>
<li>Do not download, record, copy, share, resell or publish course content, or share links to it, without our written permission.</li>
<li>Lesson videos show your name and mobile number or email while you watch, so that copies can be traced back to the account they came from.</li>
<li>We may suspend or close accounts that share content or access, and remove access without a refund in serious cases.</li>
</ul>

<h2>6. Acceptable use</h2>
<p>Please do not misuse the website, for example by trying to get around payments or access controls, interfering with the website's security, or using it to harm others.</p>

<h2>7. Changes to courses and the website</h2>
<p>We work to keep courses accurate and up to date, and we may update lessons, schedules and materials to improve them. If we have to make a major change to a course you have paid for, we will tell you and offer a fair solution.</p>

<h2>8. Our responsibility</h2>
<p>We provide courses to support your learning; exam results depend on many things, including your own work, so we cannot guarantee particular grades. We are not responsible for problems caused by things outside our reasonable control, such as internet or power outages. Nothing in these terms limits any rights you have under the law of Bangladesh.</p>

<h2>9. Changes to these terms</h2>
<p>We may update these terms from time to time. We will show the date of the latest version at the top of this page, and tell you about important changes.</p>

<h2>10. Law</h2>
<p>These terms are governed by the laws of Bangladesh.</p>

<h2>11. Contact us</h2>
${contactBlock(c)}
`);
}
