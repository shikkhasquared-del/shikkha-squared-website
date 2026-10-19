export function routeSlug(request:Request):string|null {
  try{
    const encoded=new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
    const slug=encoded?decodeURIComponent(encoded):'';
    return slug.length<=100&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)?slug:null;
  }catch{return null;}
}
