import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {findRailStations} from '../server/rail-stations.js';
import {handleAlertRequest} from '../server/alert-handler.js';
import worker from '../cloudflare/worker.js';
test('station reference covers England, Scotland and Wales with exact CRS ranked first and radius-limited nearby matches',()=>{
 assert.equal(findRailStations({query:'edb'}).stations[0].name,'Edinburgh Waverley');
 assert.ok(findRailStations({query:'Cardiff'}).stations.some(station=>station.country==='wales'));
 assert.ok(findRailStations({query:'Euston'}).stations.some(station=>station.code==='EUS'));
 const nearby=findRailStations({location:{lat:55.95,lon:-3.19},radius:10});assert.equal(nearby.stations[0].code,'EDB');assert.ok(nearby.stations.every(station=>station.distanceKm<=10));assert.ok(nearby.stations.length>1);assert.equal(nearby.liveDeparturesConnected,false);assert.equal(nearby.dataset.sourceUpdated,'2026-10-07');
 const empty=findRailStations({location:{lat:0,lon:0},radius:10});assert.equal(empty.total,0);assert.ok(findRailStations({query:'London'}).stations.length<=20);
});
test('search works without coordinates in the Worker and rejects blank/oversized queries without external requests',async()=>{
 const fetcher=()=>{throw new Error('Station reference must not fetch upstream')};
 for(const query of ['', 'x', 'a'.repeat(81)]){
 const response=await handleAlertRequest(new Request('https://test/api/alerts/rail-stations?search='+query),fetcher);assert.equal(response.status,400);
 }
 const nearby=await handleAlertRequest(new Request('https://test/api/alerts/rail-stations?lat=55.95&lon=-3.19&radius=10'),fetcher);assert.equal(nearby.status,200);assert.equal((await nearby.json()).stations[0].code,'EDB');
 const response=await worker.fetch(new Request('https://test/api/alerts/rail-stations?search=Cardiff'),{ASSETS:{fetch:()=>{throw new Error('No SPA fallback')}}});assert.equal(response.status,200);assert.ok((await response.json()).total>0);
});
test('vendored reference is pinned and licence and source provenance are distributable assets',async()=>{
 const raw=await readFile(new URL('../public/data/gb-rail-stations.json',import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),'083f835c3293bab6cc2e95c1df0d50f492c1e3a1f135c701e339d02a082e88a2');
 const licence=await readFile(new URL('../public/data/gb-rail-stations-LICENSE.txt',import.meta.url),'utf8');assert.match(licence,/Open Database License/);
 const attribution=await readFile(new URL('../public/data/gb-rail-stations-SOURCE.md',import.meta.url),'utf8');assert.match(attribution,/67dff87f51bdb782ddfcce1d8b10a88f059bf380/);assert.match(attribution,/Trainline EU/);assert.match(attribution,/OpenStreetMap/);
});
