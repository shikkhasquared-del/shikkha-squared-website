import { esc, shell, type Catalogue } from './catalog-pages';
import { canOpen, videoSource } from './lessons';
import { purchasable, taka } from './payments';
import { accessDate, accessSummary } from './access';
import { displayPhone, type Student } from './student-auth';
import type { Classroom } from './classroom';

// The classroom: one lesson at a time with the course's lesson list beside it.
const blank:Catalogue={courses:[],sections:[],instructors:[],settings:{},campaigns:[]};
const HLS={src:'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js',integrity:'sha384-V5ruNBgmYcC3SJRUQeNykAAAgde5gOFq/Hu0CZj7bygDP0yRIhkvX8+w0u/7mRvr'};
const kinds:Record<string,string>={video:'Video',reading:'Reading',quiz:'Quiz','3d':'3D resource'};

// Shown over the video so a recording or screenshot identifies the account it came from.
const watermark=(s:Student)=>[s.name,s.phone?displayPhone(s.phone):s.email].filter(Boolean).join(' · ')||s.id.slice(0,8);

function lockedPanel(room:Classroom,index:number){
  const back=`/learn/${room.slug}?lesson=${index}`;
  if(!room.student)return `<div class="lesson-locked"><strong>Sign in to continue.</strong><p>This lesson is for enrolled students.</p><a class="page-button" href="/login?next=${encodeURIComponent(back)}">Log in</a></div>`;
  const buy=purchasable(room.course)?`<a class="page-button" href="/checkout?course=${encodeURIComponent(room.slug)}">Buy this course · ${esc(taka(room.course.priceMinor))}</a>`:`<a class="page-button" href="/courses/${encodeURIComponent(room.slug)}">See enrolment options</a>`;
  if(room.access&&!room.access.active){
    const renew=purchasable(room.course)?`<a class="page-button" href="/checkout?course=${encodeURIComponent(room.slug)}">Renew access · ${esc(taka(room.course.priceMinor))}</a>`:`<a class="page-button" href="/courses/${encodeURIComponent(room.slug)}">See enrolment options</a>`;
    return `<div class="lesson-locked"><strong>Your access ended on ${esc(accessDate(room.access.expiresAt!))}.</strong><p>Renew the course to keep learning.</p>${renew}</div>`;
  }
  return `<div class="lesson-locked"><strong>This lesson is for enrolled students.</strong><p>Enrol in the course to open every lesson.</p>${buy}</div>`;
}

function lessonPanel(room:Classroom,index:number,hosts:string[]){
  const lesson=room.lessons[index];
  if(!canOpen(lesson,room.enrolled))return lockedPanel(room,index);
  const source=videoSource(lesson.resourceUrl,hosts);
  if(source){
    const src=`/learn/${room.slug}/stream/${index}/${source.masterPath.slice(source.rootPath.length)}`;
    return `<div class="lesson-player"${room.student?` data-mark="${esc(watermark(room.student))}"`:''}><video id="lesson-video" controls playsinline preload="metadata" controlsList="nodownload" data-src="${esc(src)}"></video><p class="lesson-player-error" role="alert" hidden></p></div>`;
  }
  if(lesson.resourceUrl)return `<div class="lesson-locked open"><strong>${esc(kinds[lesson.kind]||'Lesson resource')}</strong><p>This lesson opens in a new tab.</p><a class="page-button" href="${esc(lesson.resourceUrl)}" target="_blank" rel="noopener noreferrer">Open lesson</a></div>`;
  return `<div class="lesson-locked open"><strong>Coming soon.</strong><p>This lesson's material hasn't been added yet.</p></div>`;
}

export function classroomPage(room:Classroom,requested:number,hosts:string[]){
  const title=String(room.course.title||'Course');
  if(!room.lessons.length)return shell(blank,{title,description:'Course lessons',active:'courses',page:'classroom',styles:['/student.css?v=4','/classroom.css?v=5'],body:`<section class="catalog-container classroom"><nav class="page-breadcrumb" aria-label="Breadcrumb"><a href="/account">My courses</a> / <span>${esc(title)}</span></nav><div class="lesson-locked open"><strong>Lessons are on their way.</strong><p>Your course lessons will appear here as soon as they're added.</p><a class="page-button outline" href="/courses/${encodeURIComponent(room.slug)}">Course details</a></div></section>`});
  const index=Number.isInteger(requested)&&requested>=0&&requested<room.lessons.length?requested:Math.max(0,room.lessons.findIndex(l=>canOpen(l,room.enrolled)));
  const lesson=room.lessons[index];
  const list=room.lessons.map((l,i)=>{const open=canOpen(l,room.enrolled);return `<li><a href="/learn/${room.slug}?lesson=${i}" ${i===index?'aria-current="true"':''} class="${open?'':'locked'}"><span class="lesson-number">${String(i+1).padStart(2,'0')}</span><span class="lesson-name">${esc(l.title)}<small>${esc(kinds[l.kind]||l.kind)}${l.duration?' · '+esc(l.duration):''}${l.free&&!room.enrolled?' · Free preview':''}${open?'':' · Locked'}</small></span></a></li>`;}).join('');
  const nav=`<div class="lesson-nav">${index>0?`<a class="page-button outline" href="/learn/${room.slug}?lesson=${index-1}">Previous</a>`:'<span></span>'}${index<room.lessons.length-1?`<a class="page-button" href="/learn/${room.slug}?lesson=${index+1}">Next lesson</a>`:''}</div>`;
  const body=`<section class="catalog-container classroom"><nav class="page-breadcrumb" aria-label="Breadcrumb"><a href="${room.enrolled?'/account':'/courses/'+encodeURIComponent(room.slug)}">${room.enrolled?'My courses':'Course details'}</a> / <span>${esc(title)}</span></nav><div class="classroom-grid"><div class="classroom-main">${lessonPanel(room,index,hosts)}<p class="page-eyebrow">LESSON ${index+1} OF ${room.lessons.length}</p><h1>${esc(lesson.title)}</h1>${canOpen(lesson,room.enrolled)&&lesson.notes?`<p class="lesson-notes">${esc(lesson.notes)}</p>`:''}${nav}</div><aside class="classroom-lessons" aria-label="Course lessons"><h2>${esc(title)}${room.access?`<small class="classroom-access">${esc(accessSummary(room.access))}</small>`:''}</h2><ol>${list}</ol></aside></div></section>`;
  return shell(blank,{title:lesson.title+' · '+title,description:'Course lesson',active:'courses',page:'classroom',styles:['/student.css?v=4','/classroom.css?v=5'],scripts:[HLS,{src:'/player.js?v=5'}],headers:{'x-frame-options':'DENY'},body});
}
