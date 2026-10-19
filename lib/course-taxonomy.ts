export function courseLevel(course:any){return course.level||(/\bA2\b/i.test(course.title)?'a2':/\bAS\b/i.test(course.title)?'as':course.pathway==='a'?'a-level':course.pathway==='extra'?'extra':'o-level');}
export function inSection(course:any,section:any){
 if((course.sectionIds||[]).includes(section.id||section.slug))return true;
 if(section.mode==='manual')return false;
 const board=String(course.board||'').toLowerCase(),level=courseLevel(course);
 return (section.board==='all'||section.board==='edexcel'&&board.includes('edexcel')||section.board==='cambridge'&&/cambridge|caie/.test(board))&&(section.level==='all'||section.level==='a-level'&&['a-level','as','a2'].includes(level)||section.level===level)&&(section.format==='all'||section.format===course.format);
}
const nameKey=(name:string)=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function withInstructor(course:any,instructor:any){return course.instructorId?course.instructorId===(instructor.id||instructor.slug):[instructor.title,...String(instructor.aliases||'').split(',')].some(name=>nameKey(name)===nameKey(course.teacher));}
