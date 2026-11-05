import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createUpstreamReader} from '../server/upstream.js';
const url='https://example.test/feed';
const options={cacheable:true,validate:value=>{if(!Array.isArray(value))throw new Error('Invalid feed')}};
test('public-feed cache deduplicates concurrent requests and preserves timestamps on cache hits',async()=>{
 let now=100000,calls=0,release;
 const read=createUpstreamReader({now:()=>now,fetcher:async()=>{calls++;await new Promise(resolve=>release=resolve);return Response.json([{id:'one'}])}});
 const a=read(url,'json',options),b=read(url,'json',options);release();const [first,second]=await Promise.all([a,b]);assert.equal(calls,1);assert.deepEqual(first,second);
 now+=30000;const hit=await read(url,'json',options);assert.equal(hit.meta.cache,'hit');assert.equal(hit.meta.verifiedAt,first.meta.verifiedAt);assert.equal(calls,1);
});
test('conditional revalidation updates verified time without pretending the payload was downloaded again',async()=>{
 let now=100000,calls=0;
 const read=createUpstreamReader({now:()=>now,fetcher:async(_url,{headers})=>{calls++;if(calls===1)return Response.json([],{headers:{ETag:'"v1"'}});assert.equal(headers['If-None-Match'],'"v1"');return new Response(null,{status:304})}});
 const first=await read(url,'json',options);now+=61000;const second=await read(url,'json',options);assert.equal(second.meta.cache,'revalidated');assert.equal(second.meta.retrievedAt,first.meta.retrievedAt);assert.notEqual(second.meta.verifiedAt,first.meta.verifiedAt);
});
test('transient errors retry once, then fall back only within a bounded stale window',async()=>{
 let now=100000,calls=0,bad=false;
 const read=createUpstreamReader({now:()=>now,sleep:async()=>{},fetcher:async()=>{calls++;return bad?new Response('Unavailable',{status:503}):Response.json([{id:'one'}])}});
 const first=await read(url,'json',options);bad=true;now+=61000;const stale=await read(url,'json',options);assert.equal(stale.meta.state,'stale');assert.equal(stale.meta.verifiedAt,first.meta.verifiedAt);assert.equal(calls,3);
 now+=300000;await assert.rejects(()=>read(url,'json',options));assert.equal(calls,5);
});
test('malformed payloads do not poison the last valid cache entry',async()=>{
 let now=100000,bad=false;
 const read=createUpstreamReader({now:()=>now,fetcher:async()=>Response.json(bad?{error:'bad'}:[{id:'valid'}])});await read(url,'json',options);now+=61000;bad=true;
 const stale=await read(url,'json',options);assert.equal(stale.meta.state,'stale');assert.equal(stale.value[0].id,'valid');
});
test('rate limiting honors Retry-After across requests without hammering the provider',async()=>{
 let now=100000,calls=0;
 const read=createUpstreamReader({now:()=>now,fetcher:async()=>{calls++;return new Response('Rate limited',{status:429,headers:{'Retry-After':'120'}})}});
 await assert.rejects(()=>read(url,'json',options));await assert.rejects(()=>read(url,'json',options));assert.equal(calls,1);now+=121000;await assert.rejects(()=>read(url,'json',options));assert.equal(calls,2);
});
