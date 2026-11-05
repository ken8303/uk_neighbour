import {test} from 'node:test';
import assert from 'node:assert/strict';
import {airCategory,airOutlook,weatherAdvisories} from '../src/advisories.js';
import {parseTransport,getFeed} from '../server/feeds.js';
const reference=Date.parse('2026-11-04T12:00:00Z');
const advise=days=>weatherAdvisories(days,reference);
const calm={date:'2026-11-04',uv:2,high:20,low:5,gust:20,precipitation:3,code:0};
test('forecast thresholds distinguish advisories from missing data and only assess the first two days',()=>{
 const normal=advise([calm,{...calm,date:'2026-11-05'},{...calm,date:'2026-11-06',high:40}]);assert.deepEqual(normal,{items:[],missing:[]});
 const result=advise([{...calm,uv:3,high:30,low:0,gust:60,precipitation:25,code:95},{...calm,code:71}]);
 assert.deepEqual(result.items.map(x=>x.id),['uv','heat','cold','wind','rain','snow','thunder']);
 const missing=advise([{date:'2026-11-04',uv:null},{}]);assert.equal(missing.items.length,0);assert.equal(missing.missing.length,6);
 assert.equal(advise([{...calm,code:66},calm]).items[0].id,'freezing-rain');
});
test('European AQI categories use their own boundaries and reject stale or missing data',()=>{
 assert.equal(airCategory(20),'Good');assert.equal(airCategory(21),'Fair');assert.equal(airCategory(60),'Moderate');assert.equal(airCategory(61),'Poor');assert.equal(airCategory(100),'Very poor');assert.equal(airCategory(101),'Extremely poor');assert.equal(airCategory(null),'Unavailable');
 const now=Date.parse('2026-11-04T12:00:00Z'),time=now/1000;
 const data={current:{time,european_aqi:40},hourly:{time:[time-3600,time,time+3600,time+25*3600],european_aqi:[200,40,80,150]}};
 assert.equal(airOutlook(data,now).peak,80);assert.equal(airOutlook(data,now).complete,false);
 assert.throws(()=>airOutlook({...data,current:{time:time-4*3600,european_aqi:20}},now));
 assert.throws(()=>airOutlook({...data,current:{time,european_aqi:null}},now));
});
test('London line statuses exclude good service and future-only disruptions',()=>{
 const data=[{id:'central',name:'Central',lineStatuses:[{id:1,statusSeverity:10,statusSeverityDescription:'Good Service'},{id:2,statusSeverity:6,statusSeverityDescription:'Severe Delays',reason:'Test delay'},{id:3,statusSeverity:3,statusSeverityDescription:'Part Closure',validityPeriods:[{fromDate:'2026-11-05T00:00:00Z',toDate:'2026-11-06T00:00:00Z'}]}]}];
 const result=parseTransport(data,Date.parse('2026-11-04T12:00:00Z'));assert.equal(result.length,1);assert.equal(result[0].severity,'Severe Delays');assert.match(result[0].scope,/network-wide/);assert.throws(()=>parseTransport({}));
});
test('transport outside the London area provides coverage status without an unnecessary provider request',async()=>{
 const result=await getFeed('transport',{lat:55.95,lon:-3.19},25,()=>{throw new Error('Should not fetch')});assert.equal(result.coverageEligible,false);assert.deepEqual(result.items,[]);
});
