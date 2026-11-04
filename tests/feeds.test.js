import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {parseWeather,parseTraffic,polygonNear,safeSourceLink,getFeed} from '../server/feeds.js';
import {createAlertMiddleware} from '../server/api.js';
const location={lat:51.5,lon:-0.12};
const xml=`<rss xmlns:georss="http://www.georss.org/georss"><channel><title>Met Office weather warnings</title>
<item><title>Amber rain warning</title><link>https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings</link><description><![CDATA[<b>Heavy rain</b> forecast.]]></description><georss:polygon>51.4 -0.3 51.6 -0.3 51.6 0 51.4 0 51.4 -0.3</georss:polygon></item>
<item><title>Yellow warning far away</title><georss:polygon>56 -4 57 -4 57 -3 56 -3</georss:polygon></item>
<item><title>Yellow wind warning</title><link>javascript:alert(1)</link></item></channel></rss>`;
test('weather matching distinguishes nearby polygons from unlocated UK-feed warnings',()=>{
 const items=parseWeather(xml,location,10);assert.equal(items.length,2);assert.equal(items[0].scope,'Matched to your search area');assert.equal(items[0].description,'Heavy rain forecast.');assert.equal(items[1].scope,'UK feed · location not supplied');assert.match(items[1].link,/^https:\/\/www.metoffice.gov.uk/);
 assert.deepEqual(parseWeather('<rss><channel><title>Warnings</title><item><title>No warnings in force</title></item></channel></rss>',location,10),[]);
 assert.throws(()=>parseWeather('<html>Access denied</html>',location,10));
 assert.throws(()=>parseWeather('<!DOCTYPE rss><rss/>',location,10));
});
test('radius checks include polygon edges but exclude distant geometry',()=>{
 const square=[{lat:51.4,lon:0},{lat:51.6,lon:0},{lat:51.6,lon:.1},{lat:51.4,lon:.1}];
 assert.equal(polygonNear(square,location,10),true);assert.equal(polygonNear(square,location,1),false);
});
test('traffic excludes expired, future, unlocated and distant events; TfL coordinates use longitude first',()=>{
 const base={id:'near',point:'[-0.12,51.5]',location:'Test road closure',startDateTime:'2026-11-04T08:00:00Z',endDateTime:'2026-11-04T18:00:00Z'};
 const data=[base,{...base,id:'expired',endDateTime:'2026-11-03T18:00:00Z'},{...base,id:'future',startDateTime:'2026-11-05T08:00:00Z'},{...base,id:'far',point:'[-3,55]'},{...base,id:'bad',point:'bad'},{...base,id:'cleared',status:'Resolved'}];
 const result=parseTraffic(data,location,10,Date.parse('2026-11-04T12:00:00Z'));assert.deepEqual(result.map(i=>i.id),['near']);assert.equal(result[0].lat,51.5);assert.equal(result[0].lon,-.12);assert.throws(()=>parseTraffic({},location,10));
});
test('provider links reject lookalike hosts and executable schemes',()=>{
 assert.equal(safeSourceLink('https://police.uk.evil.test','police.uk','fallback'),'fallback');assert.equal(safeSourceLink('javascript:alert(1)','police.uk','fallback'),'fallback');assert.equal(safeSourceLink('http://www.met.police.uk/area','police.uk','fallback'),'https://www.met.police.uk/area');
});
test('safety lookup is a neighbourhood directory, not an incident feed',async()=>{
 const calls=[];const result=await getFeed('safety',location,25,async url=>{calls.push(url);return Response.json(calls.length===1?{force:'metropolitan',neighbourhood:'E050'}:{name:'Test neighbourhood',url_force:'https://www.met.police.uk/area'})});assert.equal(result.neighbourhood.name,'Test neighbourhood');assert.equal(calls.length,2);assert.equal('items' in result,false);
});
test('real API middleware validates input, uses fixed upstreams and reports provider failure honestly',async()=>{
 const server=createServer(createAlertMiddleware(async()=>{throw new Error('Network blocked') }));server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/api/alerts/traffic')).status,400);
  assert.equal((await fetch(base+'/api/alerts/traffic?lat=91&lon=0&radius=10')).status,400);
  const response=await fetch(base+'/api/alerts/traffic?lat=51.5&lon=-0.12&radius=10');assert.equal(response.status,502);assert.match((await response.json()).error,/official service is unavailable/);
  assert.equal((await fetch(base+'/api/alerts/weather?lat=0&lon=0&radius=10',{method:'POST'})).status,405);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
