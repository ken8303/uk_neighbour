import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getFeed,parseTransport} from '../server/feeds.js';
import {handleAlertRequest} from '../server/alert-handler.js';
test('London bus statuses distinguish routes and planned works, reject future-only status and use fixed URLs',async()=>{
 const data=[null,{id:'25',name:'25',modeName:'bus',lineStatuses:[null,{id:1,statusSeverity:0,statusSeverityDescription:'Special Service',reason:'Diversion',disruption:{category:'PlannedWork'}},{id:2,statusSeverity:10,statusSeverityDescription:'Good Service'},{id:3,statusSeverity:0,statusSeverityDescription:'Special Service',validityPeriods:[{fromDate:'2099-01-01T00:00:00Z'}]}]}];
 const parsed=parseTransport(data);assert.equal(parsed.length,1);assert.equal(parsed[0].title,'Bus 25');assert.equal(parsed[0].planned,true);assert.match(parsed[0].scope,/not a nearby-stop match/);assert.equal(parsed[0].link,'https://tfl.gov.uk/bus/status/');
 const response=await handleAlertRequest(new Request('https://test/api/alerts/buses?lat=51.5&lon=-0.12&radius=25&url=https://evil.test'),async url=>{assert.equal(url,'https://api.tfl.gov.uk/Line/Mode/bus/Status');return Response.json(data)});
 assert.equal(response.status,200);assert.equal((await response.json()).items[0].title,'Bus 25');
 const outside=await getFeed('buses',{lat:55.95,lon:-3.19},25,()=>{throw new Error('No request expected')});assert.equal(outside.coverageEligible,false);
 const failed=await handleAlertRequest(new Request('https://test/api/alerts/buses?lat=51.5&lon=-0.12&radius=25'),async()=>Response.json({bad:true}));assert.equal(failed.status,502);
});
