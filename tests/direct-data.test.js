import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleAlertRequest} from '../server/alert-handler.js';
const base='https://neighbour.test/api/alerts/';
test('postcode goes directly to its fixed provider and returns all UK country metadata',async()=>{
 const response=await handleAlertRequest(new Request(base+'postcode?postcode=EH1%201AA'),async url=>{
  assert.equal(url,'https://api.postcodes.io/postcodes/EH11AA');return Response.json({result:{latitude:55.95,longitude:-3.19,postcode:'EH1 1AA',country:'Scotland',region:null}});
 });assert.equal(response.status,200);const data=await response.json();assert.equal(data.location.country,'Scotland');assert.equal(data.location.lat,55.95);assert.equal(data.freshness.state,'fresh');
 const invalid=await handleAlertRequest(new Request(base+'postcode?postcode=not-real'),()=>{throw new Error('Should not call provider')});assert.equal(invalid.status,400);
});
test('direct forecast works outside London, requests explicit units and preserves freshness',async()=>{
 const response=await handleAlertRequest(new Request(base+'forecast?lat=55.95&lon=-3.19&radius=25'),async url=>{
  const u=new URL(url);assert.equal(u.hostname,'api.open-meteo.com');assert.equal(u.searchParams.get('latitude'),'55.95');assert.equal(u.searchParams.get('wind_speed_unit'),'kmh');assert.equal(u.searchParams.get('temperature_unit'),'celsius');assert.equal(u.searchParams.get('precipitation_unit'),'mm');
  return Response.json({daily:{time:['2026-11-04'],weather_code:[61],temperature_2m_max:[12],temperature_2m_min:[3],uv_index_max:[2],wind_gusts_10m_max:[20],precipitation_sum:[4]}});
 });assert.equal(response.status,200);const d=await response.json();assert.equal(d.days[0].high,12);assert.equal(d.days[0].precipitation,4);assert.ok(d.freshness.verifiedAt);
});
test('direct flood adapter filters inactive alerts and never fetches arbitrary supplied URLs',async()=>{
 const response=await handleAlertRequest(new Request(base+'floods?lat=51.5&lon=-0.12&radius=10&url=https://evil.test'),async url=>{const u=new URL(url);assert.equal(u.hostname,'environment.data.gov.uk');assert.equal(u.searchParams.get('dist'),'10');return Response.json({items:[{severityLevel:3},{severityLevel:4},{severityLevel:1}]})});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).items.map(x=>x.severityLevel),[1,3]);
 const invalid=await handleAlertRequest(new Request(base+'flood-area?lat=0&lon=0&radius=25&code=..%2Fsecret'),()=>{throw new Error('Should not call provider')});assert.equal(invalid.status,400);
});
test('direct air adapter preserves model timestamps and handles failed/malformed providers as unavailable',async()=>{
 const response=await handleAlertRequest(new Request(base+'air?lat=54&lon=-2&radius=25'),async url=>{assert.equal(new URL(url).hostname,'air-quality-api.open-meteo.com');return Response.json({current:{time:Math.floor(Date.now()/1000),european_aqi:40},hourly:{}})});
 assert.equal(response.status,200);assert.equal((await response.json()).current.european_aqi,40);
 const malformed=await handleAlertRequest(new Request(base+'forecast?lat=54&lon=-2&radius=25'),async()=>Response.json({error:'bad'}));assert.equal(malformed.status,502);
});
test('National Highways connector radius-filters GeoRSS, reports unlocated records and rejects old feeds',async()=>{
 const {parseHighways}=await import('../server/feeds.js');const now=Date.parse('2026-11-04T12:00:00Z');
 const xml=`<rss xmlns:georss="http://www.georss.org/georss"><channel><title>Road incidents</title><pubDate>Wed, 04 Nov 2026 11:59:00 GMT</pubDate><item><title>Test motorway incident</title><georss:point>52.49 -1.89</georss:point><pubDate>Wed, 04 Nov 2026 11:50:00 GMT</pubDate></item><item><title>Elsewhere</title><georss:point>51.5 -0.12</georss:point></item><item><title>No coordinates</title></item></channel></rss>`;
 const result=parseHighways(xml,{lat:52.48,lon:-1.9},10,now);assert.equal(result.items.length,1);assert.equal(result.items[0].title,'Test motorway incident');assert.equal(result.unlocatedCount,1);
 assert.throws(()=>parseHighways(xml,{lat:52.48,lon:-1.9},10,now+7*3600000));assert.throws(()=>parseHighways('<html>Unavailable</html>',{lat:52.48,lon:-1.9},10,now));
});
