import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePower,parseWater,getUtilityFeed} from '../server/utilities.js';
import {handleAlertRequest} from '../server/alert-handler.js';
const location={lat:51.45,lon:-0.98};
test('power filters distance and resolved reports, discloses missing coordinates, rejects schema changes',()=>{
 const result=parsePower([{faultReference:'near',latitude:51.45,longitude:-0.98},{faultReference:'far',latitude:55,longitude:-3},{faultReference:'restored',status:'Restored',latitude:51.45,longitude:-0.98},{faultReference:'unlocated',latitude:null,longitude:null}],location,10);
 assert.deepEqual(result.items.map(i=>i.id),['near']);assert.equal(result.unlocatedCount,1);
 assert.throws(()=>parsePower({error:'oops'},location,10));assert.throws(()=>parsePower([{other:'schema'}],location,10));
});
const html='<h1>Incidents</h1><a href="/network-latest/rg1-water">RG1 - Reading No water</a><a href="/network-latest/rg10-water">RG10 - No water</a><a href="https://evil.example/network-latest/rg1">RG1 fake</a>';
test('water imports official incident links only and rejects unavailable or changed pages',()=>{
 assert.equal(parseWater(html).length,2);assert.throws(()=>parseWater('<h1>Access denied</h1>'));assert.throws(()=>parseWater('<h1>Incidents</h1>'));
});
test('water matches RG1 district exactly and requests stay on fixed provider host',async()=>{
 const fetcher=async url=>{assert.equal(url,'https://www.thameswater.co.uk/network-latest');return new Response(html)};
 const data=await getUtilityFeed('water',location,25,'RG1 7PR',fetcher);assert.equal(data.items.length,1);assert.equal(data.freshness.state,'fresh');
 const unsupported=await getUtilityFeed('water',location,25,'RG10 1AA',()=>{throw new Error('Should not request')});assert.equal(unsupported.coverageEligible,false);
});
test('API validates coordinates and reports provider failure rather than an empty success',async()=>{
 assert.equal((await handleAlertRequest(new Request('https://app/api/alerts/power?postcode=RG17PR'))).status,400);
 const response=await handleAlertRequest(new Request('https://app/api/alerts/water?lat=51.45&lon=-0.98&radius=25&postcode=RG17PR'),async()=>new Response('denied',{status:403}));assert.equal(response.status,502);
});
