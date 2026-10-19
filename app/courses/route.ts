import { getCatalogue, coursesPage, unavailablePage } from '../../lib/catalog-pages';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return coursesPage(await getCatalogue(),request);}catch{return unavailablePage();}}
