import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
const output=path.resolve('.test-output/pages'),outputUrl=pathToFileURL(output).href;await fs.mkdir(output,{recursive:true});
await fs.writeFile(output+'/student-server.mjs','export async function viewerAccess(){return null;}');
await fs.writeFile(output+'/site.mjs',"export const siteOrigin=()=>'https://site.test';export const indexingAllowed=()=>globalThis.__indexing===true;");
for(const name of ['catalog-pages','course-taxonomy','route-slug','access']){let source=await fs.readFile('lib/'+name+'.ts','utf8');if(name==='catalog-pages')source=source.replace("import { readCMS } from './cms-read';",'const readCMS=async()=>{throw new Error("Not used by rendering tests");};');await fs.writeFile(output+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("from './course-taxonomy'","from './course-taxonomy.mjs'").replace("from './access'","from './access.mjs'").replace("from './site'","from './site.mjs'"));}
const {coursesPage,instructorsPage,coursePage,instructorPage,sectionPage}=await import(outputUrl+'/catalog-pages.mjs');
const section={id:'cambridge-as',title:'Cambridge AS',description:'AS courses',mode:'rules',board:'cambridge',level:'as',format:'all'};
const person={id:'bappi-sir',title:'Bappi Sir',subjects:'Physics',designation:'Instructor',bio:'Teaching Physics.',photoUrl:'',aliases:''};
const course={id:'physics-as',title:'Physics AS',subject:'Physics',teacher:'Bappi Sir',board:'Cambridge A Levels (CAIE)',pathway:'a',level:'as',format:'full',coverUrl:'',description:'Physics course.',priceMinor:449900,reference:true,enrolUrl:'https://www.shikkhasquared.com/courses/physics',sectionIds:[],instructorId:'bappi-sir',lessons:[]};
const data={courses:[course],sections:[section],instructors:[person],settings:{title:'Shikkha Squared',tagline:'Elevate Your Potential'},campaigns:[]};
test('Directories use separate canonical routes and link to dedicated detail pages',async()=>{const courses=await coursesPage(data,new Request('https://site.test/courses')).text();assert.match(courses,/href="\/courses\/physics-as"/);assert.match(courses,/href="\/instructors\/bappi-sir"/);assert.match(courses,/action="\/courses"/);const people=await instructorsPage(data,new Request('https://site.test/instructors')).text();assert.match(people,/action="\/instructors"/);assert.match(people,/data-page="instructors"/);});
test('Server-rendered category and search filters work without client JavaScript',async()=>{const match=await coursesPage(data,new Request('https://site.test/courses?section=cambridge-as&q=physics')).text();assert.match(match,/1 course<\/span>/);const absent=await coursesPage(data,new Request('https://site.test/courses?q=chemistry')).text();assert.match(absent,/data-course-card="physics-as" hidden/);assert.match(absent,/0 courses<\/span>/);});
test('Unpublished or unknown records return proper detail-page 404 responses',()=>{assert.equal(coursePage(data,'missing').status,404);assert.equal(instructorPage(data,'missing').status,404);assert.equal(coursePage(data,'physics-as').status,200);assert.equal(instructorPage(data,'bappi-sir').status,200);});
test('User-edited profile and course text cannot escape the page or its inert JSON data',async()=>{const attack='</script><script>alert(1)</script>';const clone=structuredClone(data);clone.courses[0].title=attack;clone.instructors[0].bio=attack;const html=await coursesPage(clone,new Request('https://site.test/courses')).text();assert.equal(html.includes(attack),false);assert.ok(html.includes('&lt;/script&gt;'));assert.ok(html.includes('\\u003c/script>'));const bio=await instructorPage(clone,'bappi-sir').text();assert.equal(bio.includes(attack),false);});
test('Curriculum rendering exposes only explicitly free learning resources',async()=>{const clone=structuredClone(data);clone.courses[0].lessons=[{title:'Paid lesson',kind:'video',free:false,resourceUrl:'https://private.test/paid',notes:'Private notes'},{title:'Free preview',kind:'reading',free:true,resourceUrl:'https://public.test/preview',notes:'Preview explanation'}];const html=await coursePage(clone,'physics-as').text();const visibleHtml=html.split('<script type="application/json"')[0];assert.equal(html.includes('private.test/paid'),false);assert.equal(visibleHtml.includes('private.test/paid'),false);assert.ok(visibleHtml.includes('href="/learn/physics-as?lesson=1"'));assert.equal(html.includes('public.test/preview'),false,'free previews open in the classroom, not as raw links');});

test('Each course section has its own address and rejects unknown sections',async()=>{const response=sectionPage(data,'cambridge-as',new Request('https://site.test/courses/category/cambridge-as'));assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('<title>Cambridge AS |'));assert.ok(html.includes('action="/courses/category/cambridge-as"'));assert.equal(sectionPage(data,'missing',new Request('https://site.test/courses/category/missing')).status,404);});

test('Detail slugs reject malformed encoding, injected separators, and excessive length',async()=>{const {routeSlug}=await import(outputUrl+'/route-slug.mjs');assert.equal(routeSlug(new Request('https://site.test/courses/physics-as/')),'physics-as');assert.equal(routeSlug(new Request('https://site.test/courses/%70hysics-as')),'physics-as');for(const slug of ['%E0%A4%A','%2F','%3Cscript%3E','a'.repeat(101)])assert.equal(routeSlug(new Request('https://site.test/courses/'+slug)),null);});
test('Actual detail routes return 404 for malformed slugs without calling the catalogue backend',async()=>{for(const [name,file,url] of [['course-route','app/courses/[slug]/route.ts','/courses/'],['section-route','app/courses/category/[slug]/route.ts','/courses/category/'],['instructor-route','app/instructors/[slug]/route.ts','/instructors/']]){const compiled=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"](?:\.\.\/)+lib\/([^'"]+)['"]/g,(_,module)=>'from "./'+module+'.mjs"');await fs.writeFile(output+'/'+name+'.mjs',compiled);const {GET}=await import(outputUrl+'/'+name+'.mjs');assert.equal((await GET(new Request('https://site.test'+url+'%E0%A4%A'))).status,404);assert.equal((await GET(new Request('https://site.test'+url+'%2F'))).status,404);}});

test('Public pages carry their address, link-preview tags and course details, and stay unlisted until listing is switched on',async()=>{
  const html=await coursePage(data,'physics-as').text();
  assert.match(html,/<link rel="canonical" href="https:\/\/site\.test\/courses\/physics-as">/);
  assert.match(html,/<meta property="og:title" content="Physics AS \| Shikkha Squared">/);
  assert.ok(html.includes('<meta property="og:description" content="Physics course.">'),'the preview text is the course description, unchanged');
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/,'unlisted by default');
  const details=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.deepEqual([details['@type'],details.name,details.offers.price,details.offers.priceCurrency,details.instructor.name],['Course','Physics AS','4499.00','BDT','Bappi Sir']);
  globalThis.__indexing=true;
  try{
    const listed=await coursePage(data,'physics-as').text();
    assert.equal(listed.includes('noindex'),false);
    const missing=await coursePage(data,'missing').text();
    assert.match(missing,/noindex/,'pages without their own address are never listed');
  }finally{globalThis.__indexing=false;}
  const attack=structuredClone(data);attack.courses[0].title='</script><script>alert(1)</script>';
  assert.equal((await coursePage(attack,'physics-as').text()).includes('</script><script>alert(1)'),false,'course details cannot break out of the page');
});
