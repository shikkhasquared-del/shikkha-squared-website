import { getCatalogue } from '../../lib/catalog-pages';
import { privacyPage } from '../../lib/legal-pages';
export const dynamic='force-dynamic';
// Contact details come from the admin's website settings; the page still renders if they can't be loaded.
export async function GET(){const data=await getCatalogue().catch(()=>({courses:[],sections:[],instructors:[],settings:{},campaigns:[]}));return privacyPage(data);}
