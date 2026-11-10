export class RequestBodyTooLarge extends Error {}

export async function readRequestBody(request:Request,maxBytes:number):Promise<Uint8Array<ArrayBuffer>> {
  if(Number(request.headers.get('content-length'))>maxBytes){
    void request.body?.cancel().catch(()=>{});
    throw new RequestBodyTooLarge();
  }
  if(!request.body)return new Uint8Array(0);

  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes){
        void reader.cancel().catch(()=>{});
        throw new RequestBodyTooLarge();
      }
      chunks.push(value);
    }
  }finally{
    reader.releaseLock();
  }

  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){
    bytes.set(chunk,offset);
    offset+=chunk.byteLength;
  }
  return bytes;
}
