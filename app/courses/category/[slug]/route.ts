import { getCatalogue, sectionPage, missingPage, unavailablePage } from '../../../../lib/catalog-pages';
import { routeSlug } from '../../../../lib/route-slug';
export const dynamic='force-dynamic';
export async function GET(request:Request){const slug=routeSlug(request);if(!slug)return missingPage({courses:[],sections:[],instructors:[],settings:{},campaigns:[]},'courses');try{return sectionPage(await getCatalogue(),slug,request);}catch{return unavailablePage();}}
