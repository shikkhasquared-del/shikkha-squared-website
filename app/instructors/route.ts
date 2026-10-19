import { getCatalogue, instructorsPage, unavailablePage } from '../../lib/catalog-pages';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return instructorsPage(await getCatalogue(),request);}catch{return unavailablePage();}}
