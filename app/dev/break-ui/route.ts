import { coursePage } from '../../../lib/catalog-pages';
import { classroomPage } from '../../../lib/classroom-pages';
import { accountPage } from '../../../lib/student-pages';
import { DATA_SETS, accountFor, catalogueFor, classroomFor, courseAccessFor, type DataSet } from '../../../lib/break-ui-fixtures';
export const dynamic='force-dynamic';

// Development only: renders the real course, classroom and account pages with sample data, so long names,
// missing fields and huge lists can be checked by eye. /dev/break-ui?page=classroom&data=worst
// The production build compiles this to a 404 (import.meta.env.DEV is false there).
const PAGES=['course','classroom','account'] as const;
type Page=typeof PAGES[number];
const labels:Record<string,string>={course:'Course',classroom:'Classroom',account:'Account',demo:'Demo data',worst:'Worst case',empty:'Empty',one:'One',many:'Many'};

function toggle(page:Page,data:DataSet){
  const link=(p:Page,d:DataSet,label:string,active:boolean)=>`<a href="/dev/break-ui?page=${p}&amp;data=${d}"${active?' aria-current="true"':''}>${label}</a>`;
  return `<style>.break-ui{position:fixed;left:0;right:0;bottom:12px;z-index:2000;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none;font:11px/1 system-ui,sans-serif}
.break-ui div{display:flex;gap:2px;padding:3px;border-radius:999px;background:#d9d9de;box-shadow:0 2px 10px #0004;pointer-events:auto;max-width:calc(100vw - 8px)}
.break-ui a{padding:6px 8px;border-radius:999px;color:#333;text-decoration:none;white-space:nowrap}
.break-ui a[aria-current]{background:#fff;color:#000;font-weight:600}</style>
<nav class="break-ui" aria-label="Stress-test controls"><div>${PAGES.map(p=>link(p,data,labels[p],p===page)).join('')}</div><div>${DATA_SETS.map(d=>link(page,d,labels[d],d===data)).join('')}</div></nav>`;
}

export async function GET(request:Request){
  if(!(import.meta as any).env?.DEV)return new Response('Not found.',{status:404});
  const params=new URL(request.url).searchParams;
  const page=(PAGES as readonly string[]).includes(params.get('page')||'')?params.get('page') as Page:'classroom';
  const data=(DATA_SETS as string[]).includes(params.get('data')||'')?params.get('data') as DataSet:'demo';
  const rendered=page==='course'?coursePage(catalogueFor(data),'physics-a2',{access:courseAccessFor(data)})
    :page==='classroom'?classroomPage(classroomFor(data),params.has('lesson')?Number(params.get('lesson')):-1,['.tenbytecdn.com'])
    :(()=>{const a=accountFor(data);return accountPage(a.student,{google:true,courses:a.courses,progress:a.progress});})();
  const html=(await rendered.text()).replace('</body>',toggle(page,data)+'</body>');
  return new Response(html,{status:rendered.status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
