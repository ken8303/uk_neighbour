import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFuelTime,normaliseFuelStations,rankFuelStations,getFuelPrices} from '../server/fuel.js';
import {handleAlertRequest} from '../server/alert-handler.js';
const now=Date.parse('2026-11-04T12:00:00Z');
const source={id:'test',name:'Test',url:'https://fuel.test/prices'};
const location={lat:51.5,lon:-0.12};
const station=(price,extra={})=>({site_id:'1',brand:'Test station',postcode:'SW1A 1AA',location:{latitude:51.5,longitude:-0.12},prices:{E10:price,E5:160.9,B7:150.9},...extra});
const payload=stations=>({last_updated:'04/11/2026 11:00:00',stations});
test('fuel timestamps use London time and reject nonexistent dates and DST gaps',()=>{
 assert.equal(parseFuelTime('04/11/2026 11:00:00'),Date.parse('2026-11-04T11:00:00Z'));
 assert.equal(parseFuelTime('04/07/2026 11:00:00'),Date.parse('2026-07-04T10:00:00Z'));
 assert.ok(Number.isNaN(parseFuelTime('29/03/2026 01:30:00')));
 assert.ok(Number.isNaN(parseFuelTime('31/02/2026 11:00:00')));
 assert.ok(Number.isNaN(parseFuelTime('2026-02-31T11:00:00Z')));
 assert.equal(parseFuelTime('25/10/2026 01:30:00'),Date.parse('2026-10-25T00:30:00Z'));
});
test('ranking excludes missing, zero, pound-unit, expired and distant reports, and separates grades',()=>{
 const data=payload([station(139.9),station(null),station(0),station(1.499),station(130,{last_updated:'02/11/2026 12:00:00'}),station(120,{last_updated:'04/11/2026 13:00:00'}),station(100,{location:{latitude:55,longitude:-3}}),station(110,{prices:{B7:140}})]);
 const result=normaliseFuelStations(data,source,location,10,'E10',now);
 assert.equal(result.stations.length,1);assert.equal(result.stations[0].pricePence,139.9);assert.equal(result.excluded,5);
 assert.equal(normaliseFuelStations(payload([station(139.9)]),source,location,10,'B7',now).stations[0].pricePence,150.9);
 assert.throws(()=>normaliseFuelStations({...data,last_updated:'01/11/2026 11:00:00'},source,location,10,'E10',now));
});
test('duplicate conflicting reports are excluded and newer readings supersede old ones',()=>{
 const a={dedupe:'a',id:'a',pricePence:145,distanceKm:2,reportedAt:'2026-11-04T11:00:00Z'};
 const b={...a,dedupe:'b',id:'b',pricePence:139,distanceKm:3};
 const c={...b,dedupe:'c',id:'c',distanceKm:1};
 assert.deepEqual(rankFuelStations([a,b,c]).stations.map(s=>s.id),['c','b','a']);
 assert.equal(rankFuelStations([a,{...a,pricePence:130}]).conflicts,1);
 const newer={...a,pricePence:150,reportedAt:'2026-11-04T11:30:00Z'};
 assert.equal(rankFuelStations([a,{...a,pricePence:130},newer]).stations[0].pricePence,150);
});
test('partial feeds produce a qualified comparison; public raw feeds are reused across locations',async()=>{
 let calls=0;
 const fetcher=async url=>{calls++;return url===source.url?Response.json(payload([station(139.9)])):new Response('',{status:404})};
 const sources=[source,{id:'missing',name:'Missing',url:'https://fuel.test/missing'}];
 const first=await getFuelPrices(location,10,'E10',fetcher,sources,now);
 assert.equal(first.partial,true);assert.equal(first.stations[0].pricePence,139.9);assert.equal(first.sources[1].status,'unavailable');
 const second=await getFuelPrices({lat:55,lon:-3},10,'E10',fetcher,[source],now);
 assert.equal(second.stations.length,0);assert.equal(calls,2);assert.equal(second.freshness.cache,'hit');
});
test('fuel API validates grade and fails explicitly when every provider is unavailable',async()=>{
 const invalid=await handleAlertRequest(new Request('https://test/api/alerts/fuel?lat=51.5&lon=-0.12&radius=10&fuel=cheap'),()=>{throw new Error('Must not fetch')});assert.equal(invalid.status,400);
 const failed=await handleAlertRequest(new Request('https://test/api/alerts/fuel?lat=51.5&lon=-0.12&radius=10'),async()=>new Response('',{status:404}));
 assert.equal(failed.status,502);const data=await failed.json();assert.equal(data.availability,'unavailable');assert.equal(data.stations.length,0);
});
