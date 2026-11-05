import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normaliseStops,normalisePredictions,getNearbyStops} from '../server/departures.js';
import {handleAlertRequest} from '../server/alert-handler.js';
import worker from '../cloudflare/worker.js';
const location={lat:51.5,lon:-0.12},now=Date.parse('2026-11-05T12:00:00Z'),stopId='490005646D';
const stop=(id=stopId,extra={})=>({id,commonName:'Test stop',lat:51.5,lon:-0.12,modes:['bus'],...extra});
const prediction=(id='one',extra={})=>({id,naptanId:stopId,lineName:'11',destinationName:'Test destination',timestamp:'2026-11-05T11:59:45Z',expectedArrival:'2026-11-05T12:03:00Z',modeName:'bus',...extra});
test('nearby stops reject distant/invalid/incorrect-mode records, deduplicate, sort, bound and flag partial data',()=>{
 const data={total:40,stopPoints:[stop(),stop(),stop('bad/id'),stop('490009275E',{lat:55}),stop('940GZZLUWSM',{modes:['tube']}),stop('490009275W',{lat:null}),...Array.from({length:12},(_,i)=>stop(`490TEST${i}`,{lon:-.119-i/10000}))]};
 const result=normaliseStops(data,location,'bus');assert.equal(result.stops.length,10);assert.equal(result.total,13);assert.equal(result.stops[0].id,stopId);assert.equal(result.partial,true);
 const rail=normaliseStops(data,location,'rail');assert.equal(rail.stops.length,1);assert.equal(rail.stops[0].id,'940GZZLUWSM');
 assert.throws(()=>normaliseStops({},location,'bus'));
});
test('predictions use absolute arrival times and exclude old, future-dated, expired, distant-time and wrong-stop reports',()=>{
 const data=[prediction('two',{expectedArrival:'2026-11-05T12:05:00Z'}),prediction(),prediction('old',{timestamp:'2026-11-05T11:50:00Z'}),prediction('future',{timestamp:'2026-11-05T12:05:00Z'}),prediction('past',{expectedArrival:'2026-11-05T11:58:00Z'}),prediction('ttl',{timeToLive:'2026-11-05T11:59:59Z'}),prediction('wrong',{naptanId:'OTHER'}),prediction('far',{expectedArrival:'2026-11-06T12:00:00Z'}),prediction()];
 const result=normalisePredictions(data,stopId,now);assert.deepEqual(result.predictions.map(item=>item.id),['one','two']);assert.equal(result.excludedOldReports,2);
 assert.throws(()=>normalisePredictions([prediction('old',{timestamp:'2026-11-05T11:50:00Z'})],stopId,now));assert.throws(()=>normalisePredictions({},stopId,now));assert.deepEqual(normalisePredictions([],stopId,now).predictions,[]);
});
test('stop and arrival routes validate inputs before fetching and never accept arbitrary upstream URLs',async()=>{
 for(const path of ['departures?stop=..%2Fsecret','departures?stop=https%3A%2F%2Fevil.test','stops?lat=51.5&lon=-.12&radius=25&kind=all']){
 const response=await handleAlertRequest(new Request(`https://test/api/alerts/${path}`),()=>{throw new Error('No fetch')});assert.equal(response.status,400);
 }
 let calls=0;
 const response=await handleAlertRequest(new Request('https://test/api/alerts/stops?lat=51.5&lon=-.12&radius=25&kind=bus&url=https://evil.test'),async url=>{calls++;const u=new URL(url);assert.equal(u.origin,'https://api.tfl.gov.uk');assert.equal(u.pathname,'/StopPoint');assert.equal(u.searchParams.get('radius'),'1000');return Response.json({stopPoints:[stop()]})});
 assert.equal(response.status,200);assert.equal((await response.json()).stops[0].id,stopId);assert.equal(calls,1);
 const outside=await getNearbyStops({lat:55.95,lon:-3.19},'bus',()=>{throw new Error('No fetch')});assert.equal(outside.coverageEligible,false);
});
test('Cloudflare departures handler preserves source report time and returns unavailable on source failure',async()=>{
 const original=globalThis.fetch;
 try{
 globalThis.fetch=async url=>{assert.equal(url,`https://api.tfl.gov.uk/StopPoint/${stopId}/Arrivals`);return Response.json([{...prediction(),timestamp:new Date().toISOString(),expectedArrival:new Date(Date.now()+180000).toISOString()}])};
 const response=await worker.fetch(new Request(`https://test/api/alerts/departures?stop=${stopId}`),{ASSETS:{fetch:()=>{throw new Error('No SPA fallback')}}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.predictions.length,1);assert.equal(result.freshness.sourceUpdatedAt,result.predictions[0].reportedAt);
 globalThis.fetch=async()=>new Response('',{status:429});
 const failed=await worker.fetch(new Request(`https://test/api/alerts/departures?stop=${stopId}`),{});assert.equal(failed.status,502);assert.match((await failed.json()).error,/unavailable/);
 }finally{globalThis.fetch=original}
});
