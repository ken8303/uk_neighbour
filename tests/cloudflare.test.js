import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.js';

const query='?lat=51.5&lon=-0.12&radius=25';
const env={ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname==='/'?'Neighbour app':'asset content',{headers:{'Content-Type':'text/html'}})}};
test('Cloudflare serves static requests through the asset binding',async()=>{
 const response=await worker.fetch(new Request('https://neighbour.example/'),env);
 assert.equal(response.status,200);assert.equal(await response.text(),'Neighbour app');
});
test('Cloudflare API failures stay JSON and never fall back to the SPA',async()=>{
 for(const [path,status] of [['/api',404],['/api/unknown',404],['/api/alerts/weather',400],['/api/alerts/weather?lat=&lon=&radius=10',400]]){
  const response=await worker.fetch(new Request('https://neighbour.example'+path),env);assert.equal(response.status,status);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal(response.headers.get('cache-control'),'no-store');
 }
 const response=await worker.fetch(new Request('https://neighbour.example/api/alerts/weather'+query,{method:'POST'}),env);
 assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET');
});
test('Cloudflare executes feed parsing and handles upstream failure with web-standard APIs',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async url=>{assert.equal(url,'https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/UK');return new Response('<rss><channel><title>Weather warnings</title><item><title>Amber rain warning</title><link>https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings</link></item></channel></rss>')};
  const response=await worker.fetch(new Request('https://neighbour.example/api/alerts/weather'+query),env);assert.equal(response.status,200);const data=await response.json();assert.equal(data.items[0].title,'Amber rain warning');assert.equal(data.items[0].scope,'UK feed · location not supplied');
  globalThis.fetch=async()=>{throw new Error('Provider unavailable')};
  const failed=await worker.fetch(new Request('https://neighbour.example/api/alerts/traffic'+query),env);assert.equal(failed.status,502);assert.match((await failed.json()).error,/official service is unavailable/);
 }finally{globalThis.fetch=original}
});
