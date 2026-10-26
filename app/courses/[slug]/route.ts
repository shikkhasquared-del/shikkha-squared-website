import { getCatalogue, coursePage, missingPage, unavailablePage } from '../../../lib/catalog-pages';
import { routeSlug } from '../../../lib/route-slug';
import { viewerAccess } from '../../../lib/student-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){const slug=routeSlug(request);if(!slug)return missingPage({courses:[],sections:[],instructors:[],settings:{},campaigns:[]},'courses');try{const [data,access]=await Promise.all([getCatalogue(),viewerAccess(request,slug)]);return coursePage(data,slug,{access});}catch{return unavailablePage();}}
