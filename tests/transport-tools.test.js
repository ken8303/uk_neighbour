import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normaliseCycleHire,normaliseJourneys,getCycleHire,getJourneys} from '../server/transport-tools.js';
import {handleAlertRequest} from '../server/alert-handler.js';
const now=Date.parse('2026-11-05T12:00:00Z'),location={lat:51.5,lon:-.12};
function bike(id='BikePoints_1',extra={},properties={}){
 const values={Installed:'true',Locked:'false',NbBikes:'3',NbEmptyDocks:'7',NbDocks:'12',...properties};
 return {id,commonName:'Test bikes',lat:51.5,lon:-.12,additionalProperties:Object.entries(values).map(([key,value])=>({key,value,modified:'2026-11-05T11:59:00Z'})),...extra};
}
const journey=(extra={})=>({startDateTime:'2026-11-05T12:01:00',arrivalDateTime:'2026-11-05T12:30:00',duration:29,legs:[{instruction:{summary:'Walk to Test Station'},mode:{name:'walking'},duration:5},{instruction:{summary:'Take the Test line'},mode:{name:'tube'},duration:24,isDisrupted:true,disruptions:[{description:'<p>Test disruption</p>'}]}],...extra});
test('cycle inventory preserves real zero values and excludes stale, locked, inconsistent and distant reports',()=>{
 const result=normaliseCycleHire([bike(),bike(),bike('BikePoints_2',{}, {NbBikes:'0'}),bike('BikePoints_3',{}, {Locked:'true'}),bike('BikePoints_4',{}, {NbBikes:'bad'}),bike('BikePoints_5',{}, {NbEmptyDocks:'12'}),bike('BikePoints_6',{lat:55}),bike('BikePoints_7',{additionalProperties:bike().additionalProperties.map(p=>({...p,modified:'2026-11-05T11:00:00Z'}))})],location,now);
 assert.equal(result.stations.length,2);assert.equal(result.excluded,4);assert.equal(result.stations[1].bikes,0);assert.throws(()=>normaliseCycleHire({},location,now));
});
test('journeys parse London-local times across seasons, expose notices safely and reject incomplete routes',()=>{
 const result=normaliseJourneys({journeys:[journey()]},now);assert.equal(result.journeys[0].start,'2026-11-05T12:01:00.000Z');assert.equal(result.journeys[0].legs[1].notices[0],'Test disruption');assert.equal(result.journeys[0].legs[1].disrupted,true);
 const summer=normaliseJourneys({journeys:[journey({startDateTime:'2026-07-05T12:01:00',arrivalDateTime:'2026-07-05T12:30:00'})]},Date.parse('2026-07-05T11:00:00Z'));assert.equal(summer.journeys[0].start,'2026-07-05T11:01:00.000Z');
 assert.throws(()=>normaliseJourneys({journeys:[journey({legs:[{}]})]},now));assert.throws(()=>normaliseJourneys({journeys:[journey({startDateTime:'2026-11-04T12:00:00'})]},now));assert.deepEqual(normaliseJourneys({journeys:[]},now).journeys,[]);
});
test('transport tools validate destination inputs, scope coverage and use fixed hosts without retaining route queries',async()=>{
 const invalid=await handleAlertRequest(new Request('https://test/api/alerts/journey?lat=51.5&lon=-.12&radius=25&toLat=&toLon=0'),()=>{throw new Error('No fetch')});assert.equal(invalid.status,400);
 let calls=0;const fetcher=async url=>{calls++;assert.equal(url,'https://api.tfl.gov.uk/Journey/JourneyResults/51.5,-0.12/to/51.52,-0.1');return Response.json({journeys:[journey()]})};
 await getJourneys(location,{lat:51.52,lon:-.1},fetcher,now);await getJourneys(location,{lat:51.52,lon:-.1},fetcher,now);assert.equal(calls,2);
 const outside=await getJourneys(location,{lat:55.95,lon:-3.19},()=>{throw new Error('No fetch')});assert.equal(outside.coverageEligible,false);
 const cycleOutside=await getCycleHire({lat:55.95,lon:-3.19},()=>{throw new Error('No fetch')});assert.equal(cycleOutside.coverageEligible,false);
 const failed=await handleAlertRequest(new Request('https://test/api/alerts/cycle-hire?lat=51.5&lon=-.12&radius=25'),async()=>Response.json({bad:true}));assert.equal(failed.status,502);
});
