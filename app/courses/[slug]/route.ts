import { getCatalogue, coursePage, missingPage, unavailablePage } from '../../../lib/catalog-pages';
import { routeSlug } from '../../../lib/route-slug';
import { viewerEnrolled } from '../../../lib/student-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){const slug=routeSlug(request);if(!slug)return missingPage({courses:[],sections:[],instructors:[],settings:{},campaigns:[]},'courses');try{const [data,enrolled]=await Promise.all([getCatalogue(),viewerEnrolled(request,slug)]);return coursePage(data,slug,{enrolled});}catch{return unavailablePage();}}
