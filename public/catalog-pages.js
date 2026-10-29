(()=>{
 'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const toggle=$('.catalog-menu'),nav=$('#catalog-navigation');
 const closeMenu=()=>{nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation');};
 toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});document.addEventListener('click',e=>{if(!e.target.closest('.catalog-header'))closeMenu();});
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),art=$('.catalog-hero-art');let frame=0;
 if(art){const move=e=>{if(reduce.matches)return;const box=art.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(e.clientX-(box.left+box.width/2))/box.width)),y=Math.max(-1,Math.min(1,(e.clientY-(box.top+box.height/2))/box.height));art.style.setProperty('--mx',x*8+'px');art.style.setProperty('--my',y*8-Math.min(scrollY,350)*.035+'px');};document.addEventListener('pointermove',move,{passive:true});window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!reduce.matches)art.style.setProperty('--my',-Math.min(scrollY,350)*.035+'px');});},{passive:true});}
 let data;try{data=JSON.parse($('#catalog-data').textContent);}catch{return;}
 const level=c=>c.level||(/\bA2\b/i.test(c.title)?'a2':/\bAS\b/i.test(c.title)?'as':c.pathway==='a'?'a-level':c.pathway==='extra'?'extra':'o-level');
 const matchesSection=(c,s)=>{if((c.sectionIds||[]).includes(s.id))return true;if(s.mode==='manual')return false;const board=String(c.board||'').toLowerCase(),l=level(c);return (s.board==='all'||s.board==='edexcel'&&board.includes('edexcel')||s.board==='cambridge'&&/cambridge|caie/.test(board))&&(s.level==='all'||s.level==='a-level'&&['as','a2','a-level'].includes(l)||s.level===l)&&(s.format==='all'||s.format===c.format);};
 const form=$('#course-filters')||$('#instructor-filters');if(!form)return;form.classList.add('enhanced');
 const courseMode=!!$('#course-filters'),grid=$('#catalog-grid'),cards=courseMode?$$('[data-course-card]'):$$('[data-instructor-card]');
 function apply(updateURL=true){
  const values=new FormData(form),q=String(values.get('q')||'').toLowerCase().trim();let count=0;
  if(courseMode){const section=data.sections.find(s=>s.id===values.get('section')),subject=String(values.get('subject')||''),format=String(values.get('format')||''),sort=String(values.get('sort')||'recommended');
   cards.sort((a,b)=>{const x=data.courses.find(c=>c.id===a.dataset.courseCard),y=data.courses.find(c=>c.id===b.dataset.courseCard);return sort==='az'?x.title.localeCompare(y.title):sort==='price'?(x.priceMinor??Infinity)-(y.priceMinor??Infinity):data.courses.indexOf(x)-data.courses.indexOf(y);});
   for(const card of cards){const c=data.courses.find(c=>c.id===card.dataset.courseCard);const show=(!section||matchesSection(c,section))&&(!subject||c.subject===subject)&&(!format||c.format===format)&&(!q||[c.title,c.subject,c.teacher,c.board].join(' ').toLowerCase().includes(q));card.hidden=!show;if(show)count++;grid.appendChild(card);}
   $('#listing-title').textContent=section?.title||'Learn something that matters.';$('#listing-description').textContent=section?.description||'Explore subjects, qualifications, and course formats. Choose a course to see its details.';
   $$('[data-section-choice]').forEach(a=>{if(a.dataset.sectionChoice===String(values.get('section')||''))a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  }else for(const card of cards){const p=data.instructors.find(p=>p.id===card.dataset.instructorCard);const show=!q||[p.title,p.subjects,p.designation].join(' ').toLowerCase().includes(q);card.hidden=!show;if(show)count++;}
  $('#listing-count').textContent=count+' '+(courseMode?(count===1?'course':'courses'):(count===1?'instructor':'instructors'));$('#empty-wrapper').hidden=count>0;
  if(updateURL){const url=new URL(location.href);url.search='';for(const [key,value] of values){if(value&&!(key==='sort'&&value==='recommended'))url.searchParams.set(key,String(value));}history.replaceState(null,'',url.pathname+url.search);}
 }
 form.addEventListener('submit',e=>{e.preventDefault();apply();});form.addEventListener('input',()=>apply());form.addEventListener('change',()=>apply());
 // Section links navigate to their own server-rendered category pages.
 addEventListener('popstate',()=>{const params=new URLSearchParams(location.search),category=location.pathname.match(/^\/courses\/category\/([^/]+)\/?$/)?.[1]||'';for(const field of form.elements)if(field.name)field.value=params.get(field.name)||(field.name==='sort'?'recommended':field.name==='section'?category:'');apply(false);});
 apply(false);
})();

// A teacher's photo that fails to load shows the plain person icon instead of a broken-image box.
(()=>{
 'use strict';
 const person="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ca936d' stroke-width='1.6'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 21a8 8 0 0 1 16 0'/%3E%3C/svg%3E";
 const replace=img=>{if(img.classList.contains('photo-missing'))return;img.classList.add('photo-missing');img.src=person;};
 for(const img of document.querySelectorAll('.detail-teacher img,.course-teacher img,.instructor-portrait img,.profile-photo img')){
  if(img.complete&&img.naturalWidth===0&&img.getAttribute('src'))replace(img);else img.addEventListener('error',()=>replace(img),{once:true});
 }
})();

// On phones, a long course description shows its first lines with a Read more button, so the price and
// Buy button aren't buried far below it.
(()=>{
 'use strict';
 const text=document.querySelector('.course-description');
 if(!text||!matchMedia('(max-width: 800px)').matches)return;
 text.classList.add('clamped');
 if(text.scrollHeight<=text.clientHeight+4){text.classList.remove('clamped');return;}
 const more=document.createElement('button');
 more.type='button';more.className='course-description-more';more.textContent='Read more';more.setAttribute('aria-expanded','false');
 more.addEventListener('click',()=>{const open=!text.classList.toggle('clamped');more.textContent=open?'Show less':'Read more';more.setAttribute('aria-expanded',String(open));});
 text.after(more);
})();
