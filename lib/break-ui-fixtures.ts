// Development only: sample data for the stress-test page (app/dev/break-ui). "demo" mirrors the real
// Physics A2 course; "worst" uses the longest values the admin accepts (cms-validation.ts: titles 160,
// teacher/board 100, descriptions 5,000, lesson notes 10,000, duration 40, 100 lessons; names 100) and
// realistic Bangladeshi names and email addresses. Never imported by a live page.
import type { Catalogue } from './catalog-pages';
import type { Classroom } from './classroom';
import type { Lesson } from './lessons';
import type { Progress, CourseProgress } from './progress';
import type { Enrolment } from './payments';
import type { Student } from './student-auth';

export type DataSet='demo'|'worst'|'empty'|'one'|'many';
export const DATA_SETS:DataSet[]=['demo','worst','empty','one','many'];

const DAY=24*60*60*1000;
const at=(days:number)=>new Date(Date.now()+days*DAY).toISOString();
const video='https://g28gh6aqk9.tenbytecdn.com/19c10812-7040-42ec-9463-9aea44cd6c0a/playlist.m3u8';
const worksheet='/media/0b9c4f7e-1d2a-4c3b-9e8f-112233445566';

// ---------- Students ----------
const students:Record<DataSet,Student>={
  demo:{id:'s-demo',name:'Lazim Mahmood',phone:'+8801712345678',email:'lazimjzx@gmail.com',googleSub:'g1',createdAt:at(-30)},
  // "Md." is how a large share of Bangladeshi names start; the email is a real school-domain pattern with no break points.
  worst:{id:'s-worst',name:'Md. Abdullah Al Mamun Chowdhury Bhuiyan Shahriar Kabir',phone:null,email:'abdullah.almamun.chowdhury.bhuiyan2008@students.scholasticaschool.edu.bd',googleSub:'g2',createdAt:at(-400)},
  empty:{id:'s-empty-7f3a9c21',name:'',phone:null,email:null,googleSub:null,createdAt:at(0)},
  one:{id:'s-one',name:'Jo',phone:'+8801312345678',email:null,googleSub:null,createdAt:at(-2)},
  many:{id:'s-many',name:'Nusrat Jahan',phone:'+8801912345678',email:'nusrat.jahan@gmail.com',googleSub:'g3',createdAt:at(-90)},
};

// ---------- Courses ----------
const longTitle='Cambridge International AS & A Level Physics (9702) Complete Syllabus, Past Paper Solving, Practicals (Paper 3 & 5) and Revision Crash Course';
const longDescription=('This course covers the full Cambridge International AS & A Level Physics (9702) syllabus for the May/June and October/November series. '
  +'Every topic is taught from first principles, then practised with real past-paper questions marked against the official mark schemes. '
  +'Resources: https://papers.gceguide.com/Cambridge%20International%20A%20Level/Physics%20(9702)/2023/9702_s23_qp_42.pdf\n\n').repeat(12).slice(0,5000);
const longNotes=('Before this lesson, revise kinematics and Newton’s laws. Key equations: v² = u² + 2as, F = ma, p = mv, E = ½mv².\n'
  +'Homework: 9702/42/M/J/23 Q1–Q4 and 9702/22/O/N/22 Q3. Marking scheme: https://papers.gceguide.com/Cambridge%20International%20A%20Level/Physics%20(9702)/2023/9702_s23_ms_42.pdf\n'
  +'If the video does not load, refresh the page or contact us on WhatsApp at +880 1787-668201.\n\n').repeat(40).slice(0,10000);

const lesson=(i:number,over:Partial<Lesson>={}):Lesson=>({id:'l'+i,title:`Lesson ${i+1}: Forces and motion`,kind:'video',resourceUrl:video,notes:'Newton’s laws, worked examples and a past-paper question.',duration:'28 min',free:false,...over});

const lessonsFor:Record<DataSet,Lesson[]>={
  demo:[lesson(0),lesson(1,{title:'Lesson 2: Work, energy and power',duration:'32 min'}),lesson(2,{title:'Practice worksheet',kind:'reading',resourceUrl:worksheet,duration:'',notes:'Try every question before checking the answers.'})],
  worst:[
    lesson(0,{title:'Electromagnetic induction: Faraday’s and Lenz’s laws, induced e.m.f. in a moving conductor, eddy currents, transformers and AC generators (9702 §20.5)',notes:longNotes,duration:'1 hr 45 min (incl. 30 min practice)'}),
    lesson(1,{title:'1,1,2,2-tetrachloroethane-and-2,2,4-trimethylpentane-solubility',kind:'reading',resourceUrl:worksheet,duration:'',notes:''}),
    lesson(2,{title:'চৌম্বক ক্ষেত্র ও তড়িৎচুম্বকীয় আবেশ — বাংলায় ব্যাখ্যা',duration:'৪৫ মিনিট'}),
    lesson(3,{title:'Q',duration:'',notes:''}),
    lesson(4,{title:'Past paper 9702/42/M/J/23 — full solutions 🔥📝',kind:'quiz',resourceUrl:'https://forms.gle/AbCdEfGhIjKlMnOp9',duration:'2 hr'}),
    lesson(5,{title:'Revision checklist',kind:'reading',resourceUrl:'',duration:'',notes:''}),
  ],
  empty:[],
  one:[lesson(0,{title:'Introduction'})],
  many:Array.from({length:100},(_,i)=>lesson(i,{title:`Lesson ${i+1}: ${['Kinematics','Dynamics','Forces, density and pressure','Work, energy and power','Deformation of solids','Waves','Superposition','Electricity','D.C. circuits','Particle physics'][i%10]}`,kind:i%7===6?'reading':'video',resourceUrl:i%7===6?worksheet:video})),
};

const course=(set:DataSet)=>{
  const base={id:'physics-a2',slug:'physics-a2',title:'Physics A2 Levels (Cambridge) with Bappi Sir',subject:'Physics',teacher:'Bappi sir',board:'Cambridge A Levels (CAIE)',pathway:'a',level:'a2',format:'full',
    description:'Explore physics through Shikkha Squared. Course availability, schedules, and current fees are confirmed on the official course page.',
    coverUrl:'https://shikkha-squared.sgp1.digitaloceanspaces.com/courses/SQ8HBik5kMMMLbs0T5MhaAni3WeEo7ZD.png',priceMinor:449900,enrolUrl:'',reference:false,sectionIds:['cambridge-a-levels-caie'],instructorId:'bappi-sir',checkout:true,lessons:lessonsFor[set]};
  if(set==='worst')return {...base,title:longTitle,subject:'Further Mathematics and Mechanics',teacher:'Dr. Mohammad Shahidul Islam Chowdhury (Ex-Faculty, BUET & Notre Dame College)',
    board:'Cambridge International AS & A Level (CAIE) — May/June & October/November series',description:longDescription,coverUrl:'',priceMinor:50000000,instructorId:'long-teacher'};
  if(set==='empty')return {...base,description:'',coverUrl:'',priceMinor:null,checkout:false,instructorId:''};
  if(set==='one')return {...base,title:'Jo',subject:'Art',teacher:'Jo',board:'IGCSE',priceMinor:1000,format:'crash'};
  return base;
};

export function catalogueFor(set:DataSet):Catalogue{
  const c=course(set);
  const instructors=[{id:'bappi-sir',title:'Bappi Sir',slug:'bappi-sir',subjects:'Physics',designation:'Instructor',bio:'',photoUrl:'',aliases:''},
    {id:'long-teacher',title:'Dr. Mohammad Shahidul Islam Chowdhury (Ex-Faculty, BUET & Notre Dame College)',slug:'long-teacher',subjects:'Physics, Further Mathematics, Mechanics',designation:'Senior Instructor & Head of Physics',bio:'',photoUrl:'https://example.invalid/missing-photo.jpg',aliases:''}];
  const related=set==='many'?Array.from({length:3},(_,i)=>({...course('demo'),id:'related-'+i,slug:'related-'+i,lessons:[]})):[];
  return {courses:[c,...related],sections:[{id:'cambridge-a-levels-caie',title:'Cambridge A Levels (CAIE)',slug:'cambridge-a-levels-caie',description:'',mode:'manual',board:'all',level:'all',format:'all'}],instructors,settings:{title:'Shikkha Squared',supportPhone:'+8801787668201'},campaigns:[]};
}
export const courseAccessFor=(set:DataSet)=>set==='worst'?{active:true,expiresAt:at(0.2)}:set==='one'?{active:false,expiresAt:at(-3)}:set==='many'?{active:true,expiresAt:null}:set==='demo'?{active:true,expiresAt:at(28)}:null;

// ---------- Classroom ----------
export function classroomFor(set:DataSet):Classroom{
  const lessons=lessonsFor[set];
  const progress=new Map<string,Progress>();
  const mark=(i:number,completed:boolean,positionS=0)=>lessons[i]&&progress.set(lessons[i].id,{positionS,durationS:1680,completed,updatedAt:at(-1+i/100)});
  if(set==='demo'){mark(0,true);mark(1,false,754);}
  if(set==='worst'){mark(1,true);mark(2,false,6299);mark(0,false,3725);}
  if(set==='one')mark(0,true);
  if(set==='many')for(let i=0;i<99;i++)mark(i,true);
  const c:any=course(set);
  return {slug:c.slug,course:c,published:true,lessons,student:students[set],enrolled:set!=='empty',access:courseAccessFor(set)??(set==='empty'?null:{active:true,expiresAt:at(20)}),progress};
}

// ---------- Account ----------
const enrolment=(title:string,slug:string,expiresDays:number|null):Enrolment=>({course_slug:slug,course_title:title,created_at:at(-40),expires_at:expiresDays===null?null:at(expiresDays),active:expiresDays===null||expiresDays>0});
export function accountFor(set:DataSet){
  const student=students[set];
  const courses:Enrolment[]=set==='demo'?[enrolment('Physics A2 Levels (Cambridge) with Bappi Sir','physics-a2',28)]
    :set==='worst'?[enrolment(longTitle,'long-physics',0.2),enrolment('পদার্থবিজ্ঞান ও লেভেল সম্পূর্ণ কোর্স — বাপ্পি স্যার (বাংলা মাধ্যম)','bangla-physics',3),enrolment('Chemistry AS (Edexcel IAL) — Unit 1, 2 & 3 with Practical Skills','chem-as',-12),enrolment('Q','q',null)]
    :set==='one'?[enrolment('Jo','jo',null)]
    :set==='many'?Array.from({length:30},(_,i)=>enrolment(`${['Physics','Chemistry','Biology','Mathematics','Further Mathematics','Economics'][i%6]} ${i%2?'AS':'A2'} (Cambridge) — Batch ${2020+(i%7)}`,'c'+i,i%5===0?-5:i%5===1?2:i%5===2?null:30)):[];
  const progress=new Map<string,CourseProgress>();
  if(set==='demo')progress.set('physics-a2',{done:1,total:3,lastAt:at(-1)});
  if(set==='worst'){progress.set('long-physics',{done:99,total:100,lastAt:at(-1)});progress.set('bangla-physics',{done:0,total:100,lastAt:at(-2)});progress.set('q',{done:1,total:1,lastAt:at(-3)});}
  if(set==='one')progress.set('jo',{done:1,total:1,lastAt:at(-1)});
  if(set==='many')courses.forEach((c,i)=>progress.set(c.course_slug,{done:i%11,total:10+(i%3),lastAt:at(-i)}));
  return {student,courses,progress};
}
