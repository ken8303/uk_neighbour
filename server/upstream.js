const retryable=new Set([429,500,502,503,504]);
export function createUpstreamReader({fetcher=fetch,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),ttl=60000,maxAge=300000}={}){
 const cache=new Map(),pending=new Map(),cooldowns=new Map();
 function snapshot(entry,state,cacheState){return {value:entry.value,meta:{state,cache:cacheState,retrievedAt:new Date(entry.retrievedAt).toISOString(),verifiedAt:new Date(entry.verifiedAt).toISOString(),sourceUpdatedAt:entry.sourceUpdatedAt}}}
 return async function read(url,format,{cacheable=false,notFound=false,validate=()=>{}}={}){
  const old=cacheable?cache.get(url):null;
  if(old&&now()-old.verifiedAt<ttl)return snapshot(old,'fresh','hit');
  if(cacheable&&(cooldowns.get(url)||0)>now()){if(old&&now()-old.verifiedAt<=maxAge)return snapshot(old,'stale','fallback');throw new Error('Provider retry interval has not elapsed');}
  if(cacheable&&pending.has(url))return pending.get(url);
  const work=(async()=>{
   try{
    for(let attempt=0;attempt<2;attempt++){
     const headers={Accept:format==='xml'?'application/rss+xml, application/xml, text/xml':'application/json'};
     if(old?.etag)headers['If-None-Match']=old.etag;
     if(old?.lastModified)headers['If-Modified-Since']=old.lastModified;
     let response;
     try{response=await fetcher(url,{signal:AbortSignal.timeout(8000),headers})}
     catch(error){if(attempt===0&&cacheable){await sleep(250);continue;}throw error;}
     if(response.status===304&&old){const entry={...old,verifiedAt:now()};cache.set(url,entry);return snapshot(entry,'fresh','revalidated');}
     if(notFound&&response.status===404)return snapshot({value:null,retrievedAt:now(),verifiedAt:now(),sourceUpdatedAt:null},'fresh','miss');
     if(!response.ok){
      const retryAfter=response.headers.get('retry-after');
      if(cacheable&&(response.status===429||retryAfter)){const seconds=Number(retryAfter);const delay=retryAfter?(Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-now()):60000;cooldowns.set(url,now()+Math.max(1000,Number.isFinite(delay)?delay:60000));}
      // Do not immediately retry rate-limited requests or ignore a provider's Retry-After.
      if(attempt===0&&cacheable&&retryable.has(response.status)&&response.status!==429&&!retryAfter){await sleep(250);continue;}
      throw new Error(`Provider unavailable (${response.status})`);
     }
     const value=format==='xml'?await response.text():await response.json();validate(value);
     const lastModified=response.headers.get('last-modified');
     const entry={value,retrievedAt:now(),verifiedAt:now(),etag:response.headers.get('etag'),lastModified,sourceUpdatedAt:Number.isFinite(Date.parse(lastModified))?new Date(lastModified).toISOString():null};
     if(cacheable){cache.set(url,entry);cooldowns.delete(url);}
     return snapshot(entry,'fresh','miss');
    }
    throw new Error('Provider unavailable');
   }catch(error){
    if(old&&now()-old.verifiedAt<=maxAge)return snapshot(old,'stale','fallback');
    if(cacheable)cache.delete(url);
    throw error;
   }
  })();
  if(cacheable)pending.set(url,work);
  try{return await work}finally{if(cacheable)pending.delete(url)}
 };
}
const readers=new WeakMap();
export function readerFor(fetcher){if(!readers.has(fetcher))readers.set(fetcher,createUpstreamReader({fetcher}));return readers.get(fetcher)}
