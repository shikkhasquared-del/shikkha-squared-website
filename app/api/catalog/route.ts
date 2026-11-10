import { readCMS } from '../../../lib/cms-read';
import type { PublishedCatalogue } from '../../../lib/catalogue-types';
export const dynamic='force-dynamic';
export async function GET(){try{const result=await readCMS('/api/published');if(!result.ok)throw new Error('CMS unavailable');const data=await result.json() as PublishedCatalogue;return Response.json({initialized:!!data.initialized,catalogueEnabled:!!data.catalogueEnabled,settings:data.settings,courses:data.courses,content:data.content,campaigns:data.campaigns,sections:data.sections||[],instructors:data.instructors||[]},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}catch{return Response.json({error:'The managed catalogue is temporarily unavailable.'},{status:503,headers:{'cache-control':'no-store'}});}}
