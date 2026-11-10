(() => {
  'use strict';

  let courses = [
    {id:'caie-physics',title:'Physics: Full course',board:'CAIE O Levels',pathway:'caie',format:'full',teacher:'Bappi Sir',cover:1,subject:'Physics',source:'Supplied course-banner PDF, page 1'},
    {id:'caie-physics-crash',title:'Physics: Crash course',board:'CAIE O Levels',pathway:'caie',format:'crash',teacher:'Bappi Sir',cover:2,subject:'Physics',source:'Supplied course-banner PDF, page 2'},
    {id:'caie-physics-papers',title:'Physics: Past-paper solutions',board:'CAIE O Levels',pathway:'caie',format:'papers',teacher:'Bappi Sir',cover:3,subject:'Physics',source:'Supplied course-banner PDF, page 3'},
    {id:'igcse-physics',title:'Physics: Full course',board:'Edexcel IGCSE O Levels',pathway:'igcse',format:'full',teacher:'Bappi Sir',cover:4,subject:'Physics',source:'Supplied course-banner PDF, page 4; page 5 is an alternate cover'},
    {id:'igcse-physics-crash',title:'Physics: Crash course',board:'Edexcel IGCSE O Levels',pathway:'igcse',format:'crash',teacher:'Bappi Sir',cover:6,subject:'Physics',source:'Supplied course-banner PDF, page 6'},
    {id:'igcse-physics-papers',title:'Physics: Past-paper solutions',board:'Edexcel IGCSE O Levels',pathway:'igcse',format:'papers',teacher:'Bappi Sir',cover:7,subject:'Physics',source:'Supplied course-banner PDF, page 7'},
    {id:'a-level-business',title:'A Level Business',board:'CAIE A Levels',pathway:'a',format:'full',teacher:'Nayeem Sir',cover:null,subject:'Business',reference:true,source:'https://www.shikkhasquared.com/courses/business-caie-a-level-9609-with-nayeem-sir-mayjune-2026'},
    {id:'a-level-chemistry',title:'A Level Chemistry',board:'Edexcel A Levels',pathway:'a',format:'full',teacher:'Mobarak Sir',cover:null,subject:'Chemistry',reference:true,source:'https://www.shikkhasquared.com/courses/chemistry-edexcel-a-level-with-mobarak-sir'}
  ];
  const formatLabels = {full:'Full course',crash:'Crash course',papers:'Past papers',live:'Live classes',recorded:'Recorded classes',modular:'Modular',mock:'Mock exam',demo:'Demo',extra:'Extra Curricular'};
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = str => String(str).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  let saved = new Set();
  try { const stored=JSON.parse(localStorage.getItem('shikkha-shortlist')||'[]'); if(Array.isArray(stored)) saved=new Set(stored.filter(id=>courses.some(course=>course.id===id))); } catch {}
  let activeFilter='all';
  let toastTimer;
  let returnHash='#courses';
  let supportWhatsApp='8801787668201';
  const grid=$('#course-grid');

  function artwork(course) {
    if(course.coverUrl) return `<img class="card-cover" src="${escape(course.coverUrl)}" alt="${escape(course.title)}" loading="lazy">`;
    if(course.cover) return `<img class="card-cover" src="assets/physics-cover-${course.cover}.webp" width="1355" height="762" alt="${escape(course.board)} ${escape(course.title)} with ${escape(course.teacher)}" loading="lazy">`;
    return `<div class="abstract-cover ${course.subject.toLowerCase()==='chemistry'?'chemistry':''}"><span class="cover-label">${escape(course.board)} / COURSE REFERENCE</span><strong>${escape(course.subject)}<br><span class="orange-text">A Levels.</span></strong><small>WITH ${escape(course.teacher.toUpperCase())}</small><span class="abstract-square" aria-hidden="true"></span></div>`;
  }
  function courseCard(course) {
    const isSaved=saved.has(course.id);
    return `<article class="course-card" data-tilt><div class="card-image-wrap">${artwork(course)}<button class="card-save" data-save="${course.id}" aria-label="${isSaved?'Remove':'Save'} ${escape(course.title)}, ${escape(course.board)}${isSaved?' from saved courses':''}" aria-pressed="${isSaved}">${icon('save')}</button></div><div class="card-content"><div class="card-meta"><span class="card-board">${escape(course.board)}</span><span class="card-format ${course.format}">${course.reference?'Catalogue reference':formatLabels[course.format]}</span></div><h3>${escape(course.title)}</h3><p class="card-teacher"><span class="teacher-mark" aria-hidden="true">${escape(course.teacher.split(' ').map(s=>s[0]).join(''))}</span>With ${escape(course.teacher)}</p><div class="card-bottom"><span>${course.priceMinor===0?'Free':Number.isInteger(course.priceMinor)?new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(course.priceMinor/100):'Ask for availability'}</span><a class="text-link" href="/courses/${encodeURIComponent(course.id)}" aria-label="View ${escape(course.title)}, ${escape(course.board)}">Course details ${icon('up')}</a></div></div></article>`;
  }
  function renderCourses() {
    const query=$('#course-search').value.toLowerCase().trim();
    const format=$('#course-format').value;
    const matches=courses.filter(course => {
      const pathwayMatch=activeFilter==='all'||(activeFilter==='saved'?saved.has(course.id):course.pathway===activeFilter);
      const searchMatch=`${course.title} ${course.teacher} ${course.board} ${formatLabels[course.format]}`.toLowerCase().includes(query);
      return pathwayMatch&&searchMatch&&(format==='all'||course.format===format);
    });
    grid.innerHTML=matches.length ? matches.slice(0,6).map(courseCard).join('') : `<div class="empty-state">${icon(activeFilter==='saved'?'save':'search')}<h3>${activeFilter==='saved'?'Make space for your favourites.':'No courses found.'}</h3><p>${activeFilter==='saved'?'Tap the bookmark on a course to keep it in your shortlist.':'Try a different subject, teacher or filter.'}</p><button class="btn btn-glass btn-small" data-reset>Explore all courses ${icon('arrow')}</button></div>`;
    $('#course-count').textContent=`${matches.length} ${matches.length===1?'course':'courses'}${matches.length>6?' · 6 shown':''}`;
    $('#saved-count').textContent=String(saved.size);
    $$('.filter-chip').forEach(button=>{const isActive=button.dataset.filter===activeFilter;button.classList.toggle('active',isActive);button.setAttribute('aria-pressed',String(isActive));});
  }
  function resetFilters() {activeFilter='all';$('#course-search').value='';$('#course-format').value='all';renderCourses();}
  function showToast(message) {const toast=$('#toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2700);}
  function toggleSave(id) {
    if(saved.has(id))saved.delete(id);else saved.add(id);
    try {localStorage.setItem('shikkha-shortlist',JSON.stringify([...saved]));} catch {}
    const keepFocus=document.activeElement?.dataset.save===id;
    renderCourses();
    if(keepFocus) ($(`[data-save="${id}"]`)||$('[data-filter="saved"]')).focus();
    showToast(saved.has(id)?'Added to your shortlist.':'Removed from your shortlist.');
  }
  function openModal(dialog) {if(!dialog.open) dialog.showModal();document.body.classList.add('dialog-open');}
  function openContact(course) {
    if($('#course-dialog').open) $('#course-dialog').close();
    if(course) {$('#contact-form').elements.subject.value=course.subject;$('#contact-form').elements.pathway.value=course.pathway==='caie'?'CAIE O Levels':course.pathway==='igcse'?'Edexcel IGCSE':'AS Levels';$('#contact-form').elements.message.value=`I'd like to know more about ${course.title} with ${course.teacher} (${course.board}). Please share current fees and availability.`;}
    $('#contact-result').replaceChildren();
    openModal($('#contact-dialog'));
    $('#contact-form').elements.name.focus();
  }
  const topics={
    Physics:[['Build the foundations','Start with a clear idea: how forces, motion and energy relate to the world around you.'],['Put concepts to work','Move from an explanation to a worked example. Practise setting out the steps and using the right units.'],['Think through exam questions','Use a question to test understanding, then look closely at the reasoning behind the answer.']],
    Business:[['Understand a business','Explore the purpose of a business and how its decisions affect people.'],['Connect the functions','Think about how marketing, operations and finance fit together.'],['Develop an argument','Practise explaining a decision, considering alternatives and reaching a reasoned conclusion.']],
    Chemistry:[['Understand the building blocks','Connect particles, structures and bonding with observable properties.'],['Explain a change','Use chemical ideas to describe reactions and make sense of patterns.'],['Practise the reasoning','Work through an example, check the units and explain why the answer makes sense.']]
  };
  function openCourse(id,updateHash=true) {
    const course=courses.find(c=>c.id===id);if(!course)return;
    if(updateHash) {returnHash=location.hash.startsWith('#course-')?'#courses':(location.hash||'#courses');history.replaceState(null,'',`#course-${course.id}`);}
    $('#course-detail').innerHTML=`<div class="course-detail-layout"><div><div class="detail-media">${artwork(course)}</div><p class="detail-asset-note">${course.reference?'Catalogue name referenced from the existing website; abstract artwork is illustrative. Confirm current offerings with admissions.':'Original course-cover artwork supplied by Shikkha Squared.'}</p></div><div class="detail-content"><p class="eyebrow">${escape(course.board)} / ${formatLabels[course.format].toUpperCase()}</p><h2 id="detail-title">${escape(course.title)}</h2><p class="detail-author">With ${escape(course.teacher)}</p><p class="detail-description">${course.description?escape(course.description):course.format==='papers'?'A question is more useful when you understand the reasoning behind its answer. Explore a past-paper learning pathway.':course.format==='crash'?'Bring the important ideas into focus. Explore a revision pathway for the next stage of your preparation.':'Make space for understanding, one idea at a time. Explore a subject pathway that starts with your curiosity.'}</p><p class="detail-example-label">${course.lessons?.length?'Course curriculum':'Illustrative learning journey'}</p><div class="detail-outline">${(course.lessons?.length?course.lessons.map(l=>`<details><summary>${escape(l.title)}${l.duration?' · '+escape(l.duration):''}</summary><p>${escape(l.free?l.notes:'This lesson is part of the course curriculum. Contact admissions for access.')}</p>${l.free&&l.resourceUrl?`<a class="text-link" href="${escape(l.resourceUrl)}" target="_blank" rel="noopener noreferrer">Open free ${escape(l.kind)} resource ${icon('up')}</a>`:''}</details>`):(topics[course.subject]||[['Discover the subject','Explore the ideas with your instructor.'],['Build your understanding','Work through examples and learning resources.'],['Put learning into practice','Check your understanding and develop your skills.']]).map(([title,copy])=>`<details><summary>${escape(title)}</summary><p>${escape(copy)}</p></details>`)).join('')}</div><p class="detail-fee">${Number.isInteger(course.priceMinor)?'Course fee: '+new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(course.priceMinor/100):'Fees, lesson schedules, syllabus coverage and inclusions are confirmed by admissions. This outline demonstrates the proposed interface.'}</p>${course.enrolUrl?`<a class="btn btn-orange" href="${escape(course.enrolUrl)}" target="_blank" rel="noopener noreferrer">Enrol in this course ${icon('up')}</a>`:`<button class="btn btn-orange" data-course-contact="${course.id}">Ask about this course ${icon('up')}</button>`}<a class="text-link" href="https://www.shikkhasquared.com/" target="_blank" rel="noopener">Visit the current website ${icon('up')}</a></div></div>`;
    openModal($('#course-dialog'));
  }

  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    if(target.hasAttribute('data-save'))toggleSave(target.dataset.save);
    if(target.hasAttribute('data-course'))openCourse(target.dataset.course);
    if(target.hasAttribute('data-reset'))resetFilters();
    if(target.hasAttribute('data-filter')){activeFilter=target.dataset.filter;renderCourses();}
    if(target.hasAttribute('data-contact'))openContact();
    if(target.hasAttribute('data-course-contact'))openContact(courses.find(c=>c.id===target.dataset.courseContact));
    if(target.hasAttribute('data-preview')){renderLesson();renderResource('notes');openModal($('#preview-dialog'));}
    if(target.hasAttribute('data-close'))target.closest('dialog').close();
    if(target.hasAttribute('data-mode'))setExperience(target.dataset.mode);
    if(target.hasAttribute('data-resource'))renderResource(target.dataset.resource);
    if(target.hasAttribute('data-lesson')){lessonIndex=Number(target.dataset.lesson);renderLesson();}
    if(target.hasAttribute('data-answer'))answerPractice(Number(target.dataset.answer),target);
  });
  $('#course-search').addEventListener('input',renderCourses);
  $('#course-format').addEventListener('change',renderCourses);
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();});
    dialog.addEventListener('close',()=>{if(!$('dialog[open]'))document.body.classList.remove('dialog-open');if(dialog.id==='course-dialog'&&location.hash.startsWith('#course-'))history.replaceState(null,'',returnHash);});
  });
  function handleCourseHash() {if(location.hash.startsWith('#course-'))openCourse(location.hash.slice(8),false);}
  window.addEventListener('hashchange',handleCourseHash);
  const menuToggle=$('.menu-toggle');
  function closeMenu(){ $('#nav-links').classList.remove('open');menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','Open navigation');}
  menuToggle.addEventListener('click',()=>{const open=$('#nav-links').classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
  $$('.nav-links a').forEach(link=>link.addEventListener('click',closeMenu));
  document.addEventListener('click',event=>{if(!event.target.closest('.liquid-nav'))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});

  const experience={
    recorded:{label:'ON YOUR TERMS',headline:'Pause. Replay. Get it.',copy:'Return to an explanation when you need it. Give a difficult idea the time it deserves.',scene:`<div class="scene-player"><p class="micro">A MOMENT OF CLARITY / PHYSICS</p><div class="scene-equation">F <span>=</span> m × a</div><div class="scene-controls">${icon('play')}<div><i></i></div><small>YOUR PACE</small></div></div><span class="scene-sticker glass">That makes sense. ↗</span>`},
    live:{label:'MAKE IT A CONVERSATION',headline:'Ask the question.',copy:'Bring your questions into a live classroom. A conversation can make a difficult idea feel a little closer.',scene:`<div class="scene-live"><span class="avatar-circle">${icon('cap')}</span><span><strong>Your teacher.<br>Right here.</strong><small>Illustrative live learning interface</small></span></div><div class="scene-question glass"><span>GOOD QUESTION ↗</span>“Could we work through that once more?”</div>`},
    papers:{label:'PUT UNDERSTANDING INTO PRACTICE',headline:'Know why. Then try.',copy:'Connect an idea to an exam-style question. Work through the method, then use the feedback to make your next attempt stronger.',scene:`<div class="scene-paper"><p class="micro">SAMPLE PHYSICS QUESTION</p><strong>A force changes<br>how things move.</strong><p>A 3 kg object accelerates at 2 m/s².<br>Calculate the resultant force.</p><hr><div class="paper-answer">F = 3 × 2 = 6 N</div></div><span class="scene-sticker glass">The method matters. ✓</span>`}
  };
  function setExperience(mode){const item=experience[mode];if(!item)return;$('#experience-label').textContent=item.label;$('#experience-headline').textContent=item.headline;$('#experience-copy').textContent=item.copy;$('#experience-scene').innerHTML=item.scene;$('#experience-panel').setAttribute('aria-labelledby',`tab-${mode}`);$$('.experience-option').forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});}
  function wireTabKeys(selector,activate,vertical=false){const tabs=$$(selector);tabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{let next;if(event.key===(vertical?'ArrowDown':'ArrowRight'))next=(index+1)%tabs.length;else if(event.key===(vertical?'ArrowUp':'ArrowLeft'))next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();tabs[next].focus();activate(tabs[next]);}));}
  wireTabKeys('.experience-option',tab=>setExperience(tab.dataset.mode),true);

  let lessonIndex=0;
  const completed=new Set();
  const lessons=[
    {title:"Newton's second law",equation:'F <span>=</span> m × a',explanation:'A force changes how an object moves. Mass tells us how much force we need for a given acceleration.'},
    {title:'Put the relationship to work',equation:'3 × 2 <span>=</span> 6 N',explanation:'For a mass of 3 kg and an acceleration of 2 m/s², the resultant force is 6 newtons. Multiply the mass by the acceleration.'},
    {title:'Explain the units',equation:'1 N <span>=</span> 1 kg·m/s²',explanation:'A newton is the resultant force needed to accelerate 1 kg at 1 m/s². This is why mass in kilograms and acceleration in m/s² give force in newtons.'}
  ];
  function renderLesson(){const lesson=lessons[lessonIndex];$('#lesson-kicker').textContent=lesson.title;$('#lesson-equation').innerHTML=lesson.equation;$('#lesson-explanation').textContent=lesson.explanation;$('#lesson-step').textContent=`Step ${lessonIndex+1} of 3`;$('#lesson-play').innerHTML=`${icon('play')}${lessonIndex===2?'Start again':lessonIndex===0?'Walk me through it':'Next step'}`;$$('.lesson-row').forEach(row=>{row.classList.toggle('active',Number(row.dataset.lesson)===lessonIndex);row.classList.toggle('complete',completed.has(Number(row.dataset.lesson)));row.setAttribute('aria-current',Number(row.dataset.lesson)===lessonIndex?'step':'false');});$('#demo-progress-label').textContent=`${completed.size} of 3 steps complete`;$('#demo-progress-bar').style.width=`${completed.size/3*100}%`;$('#lesson-complete').disabled=completed.has(lessonIndex);$('#lesson-complete').innerHTML=`${icon('check')}${completed.has(lessonIndex)?'Step completed':'Mark this step complete'}`;}
  $('#lesson-play').addEventListener('click',()=>{lessonIndex=(lessonIndex+1)%3;renderLesson();});
  $('#lesson-complete').addEventListener('click',()=>{completed.add(lessonIndex);renderLesson();if(completed.size===3)showToast('All three sample steps complete. Keep your curiosity going.');});
  function renderResource(resource){$$('[data-resource]').forEach(tab=>{const active=tab.dataset.resource===resource;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});$('#resource-panel').setAttribute('aria-labelledby',`resource-tab-${resource}`);$('#resource-panel').innerHTML=resource==='practice'?`<strong>Your turn.</strong><p>A 4 kg object has a resultant force acting on it and accelerates at 3 m/s². What is the resultant force?</p><div class="practice-options" role="group" aria-label="Choose the resultant force"><button data-answer="7">7 N</button><button data-answer="12">12 N</button><button data-answer="1.33">1.33 N</button></div><p id="practice-result" role="status" aria-live="polite"></p>`:`<strong>The relationship: F = m × a</strong><ul><li>F is the resultant force, measured in newtons (N).</li><li>m is mass, measured in kilograms (kg).</li><li>a is acceleration, measured in metres per second squared (m/s²).</li></ul><p>For 3 kg at 2 m/s²: <strong>F = 6 N.</strong> Check the units before substituting values.</p>`;}
  function answerPractice(answer,button){$$('[data-answer]').forEach(item=>{item.classList.remove('correct','incorrect');item.setAttribute('aria-pressed','false');});button.classList.add(answer===12?'correct':'incorrect');button.setAttribute('aria-pressed','true');$('#practice-result').textContent=answer===12?'Correct. F = m × a = 4 × 3 = 12 N. You multiplied mass by acceleration.':'Try multiplying the mass by the acceleration: 4 × 3. Check your method, then choose again.';}
  wireTabKeys('[data-resource]',tab=>renderResource(tab.dataset.resource));

  $('#contact-form').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const name=String(form.get('name')).trim();if(!name){event.currentTarget.elements.name.setCustomValidity('Please enter your name.');event.currentTarget.elements.name.reportValidity();return;}const subject=String(form.get('subject')||'').trim();const message=String(form.get('message')||'').trim();const text=`Hello Shikkha Squared, I'm ${name}.\nPathway: ${form.get('pathway')}${subject?'\nSubject: '+subject:''}\n\n${message||'Please help me with course availability, fees and the next steps for enrolment.'}`;const result=$('#contact-result');result.replaceChildren();const p=document.createElement('p');p.textContent='Your message is ready. Open WhatsApp to review and send it to the Shikkha Squared team.';const link=document.createElement('a');link.href=`https://wa.me/${supportWhatsApp}?text=${encodeURIComponent(text)}`;link.target='_blank';link.rel='noopener noreferrer';link.className='btn btn-orange btn-small';link.textContent='Open WhatsApp';result.append(p,link);});
  $('#contact-form').elements.name.addEventListener('input',event=>event.target.setCustomValidity(''));
  renderCourses();setExperience('recorded');renderLesson();renderResource('notes');handleCourseHash();

  async function loadManagedWebsite(){
    try {
      const response=await fetch('/api/catalog',{cache:'no-store'});if(!response.ok)return;
      const data=await response.json();if(!data.initialized)return;
      if(data.catalogueEnabled&&Array.isArray(data.courses)){
        courses=data.courses;saved=new Set([...saved].filter(id=>courses.some(c=>c.id===id)));renderCourses();
        window.SHIKKHA_CATALOGUE=Object.freeze(courses.map(c=>Object.freeze({...c})));handleCourseHash();
      }
      const settings=data.settings;
      if(settings){
        if(settings.seoTitle)document.title=settings.seoTitle;
        const description=$('meta[name="description"]');if(description&&settings.seoDescription)description.content=settings.seoDescription;
        if(settings.heroHeadline){const heading=$('.hero-copy h1');if(heading)heading.textContent=settings.heroHeadline;}
        if(settings.heroDescription){const copy=$('.hero-description');if(copy)copy.textContent=settings.heroDescription;}
        if(settings.tagline){$$('.brand small').forEach(el=>el.textContent=settings.tagline);if(!settings.heroHeadline&&settings.tagline!=='Elevate Your Potential'){const heading=$('#hero-title');if(heading)heading.textContent=settings.tagline;}}
        if(settings.title)$$('.brand > span').forEach(el=>{const dot=document.createElement('span');dot.className='brand-dot';dot.textContent='.';el.replaceChildren(document.createTextNode(settings.title),dot);});
        if(settings.address){const footer=$('footer');if(footer){const address=document.createElement('address');address.className='managed-address container';address.textContent=settings.address;footer.append(address);}}
        const digits=String(settings.supportPhone||'').replace(/[^0-9]/g,'');if(digits.length>=10&&digits.length<=15){supportWhatsApp=digits;$$('a[href^="https://wa.me/"]').forEach(el=>el.href='https://wa.me/'+digits);}
        if(settings.supportEmail)$$('a[href^="mailto:"]').forEach(el=>{el.href='mailto:'+settings.supportEmail;el.textContent=settings.supportEmail;});
        if(settings.supportPhone)$$('a[href^="tel:"]').forEach(el=>{el.href='tel:'+settings.supportPhone;el.textContent=settings.supportPhone;});
        if(settings.announcement){const bar=document.createElement('div');bar.className='managed-announcement';bar.textContent=settings.announcement;$('.site-header')?.insertAdjacentElement('afterend',bar);if(!bar.isConnected)$('main')?.prepend(bar);}
      }
      for(const item of data.campaigns||[]){
        const banner=document.createElement('aside');banner.className='managed-banner container';banner.setAttribute('aria-label','Shikkha Squared promotion');
        banner.innerHTML=`${item.imageUrl?`<img src="${escape(item.imageUrl)}" alt="" loading="lazy">`:''}<div><p class="eyebrow">SHIKKHA SQUARED / WHAT’S NEXT</p><h2>${escape(item.headline)}</h2><p>${escape(item.body)}</p></div>${item.destinationUrl?`<a class="btn btn-orange btn-small" href="${escape(item.destinationUrl)}" target="_blank" rel="noopener noreferrer">${escape(item.cta||'Learn more')} ${icon('up')}</a>`:''}`;
        const target=item.placement==='footer'?$('footer'):item.placement==='courses'?$('#courses'):$('.hero')||$('#courses');
        if(target)target.insertAdjacentElement(item.placement==='top'?'afterend':'beforebegin',banner);
      }
      const content=data.content||[];const articles=content.filter(c=>c.type!=='faq');const faqs=content.filter(c=>c.type==='faq');
      if(articles.length){
        const section=document.createElement('section');section.className='managed-content container';section.id='updates';
        section.innerHTML=`<div class="section-heading"><div><p class="eyebrow">FROM SHIKKHA SQUARED</p><h2>Keep your curiosity going.</h2></div></div><div class="managed-content-grid">${articles.map(c=>`<article>${c.imageUrl?`<img src="${escape(c.imageUrl)}" alt="${escape(c.title)}" loading="lazy">`:''}<p class="eyebrow">${escape(c.type)}</p><h3>${escape(c.title)}</h3><p class="managed-body">${escape(c.body)}</p>${c.linkUrl?`<a class="text-link" href="${escape(c.linkUrl)}" target="_blank" rel="noopener noreferrer">${escape(c.linkLabel||'Read more')} ${icon('up')}</a>`:''}</article>`).join('')}</div>`;
        const target=$('#faq')||$('footer');if(target)target.insertAdjacentElement('beforebegin',section);
      }
      if(faqs.length){const list=$('.faq-list');if(list){list.innerHTML=faqs.map(c=>`<details><summary>${escape(c.title)}${icon('plus')}</summary><p class="managed-body">${escape(c.body)}</p></details>`).join('');}}
    }catch{ /* Keep the existing website usable during a temporary CMS outage. */ }
  }
  loadManagedWebsite();

  // Public, read-only catalogue export for the developer handoff.
  window.SHIKKHA_CATALOGUE=Object.freeze(courses.map(course=>Object.freeze({...course})));
})();
