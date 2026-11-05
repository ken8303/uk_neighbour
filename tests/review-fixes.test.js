import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {createAlertMiddleware} from '../server/api.js';
import {handleAlertRequest} from '../server/alert-handler.js';
import {londonDate,nextLondonMidnight,upcomingForecast} from '../src/calendar.js';
import {weatherAdvisories} from '../src/advisories.js';

test('malformed HTTP targets return JSON 400 and the same Node server stays alive',async()=>{
 const api=createAlertMiddleware(),server=createServer((req,res)=>api(req,res,()=>res.end('healthy')));
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 try{
  const bad=await new Promise((resolve,reject)=>{const r=request({hostname:'127.0.0.1',port,path:'http://[',method:'GET'},res=>{let text='';res.on('data',d=>text+=d);res.on('end',()=>resolve({status:res.statusCode,text,type:res.headers['content-type']}))});r.on('error',reject);r.end()});
  assert.equal(bad.status,400);assert.match(bad.type,/application\/json/);assert.equal(JSON.parse(bad.text).error,'Invalid URL');
  const healthy=await fetch(`http://127.0.0.1:${port}/`);assert.equal(healthy.status,200);assert.equal(await healthy.text(),'healthy');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
test('unexpected asynchronous Node handler errors return a controlled error',async()=>{
 const api=createAlertMiddleware();let status,body;
 await api({url:'/',method:'GET'},{writeHead:s=>status=s,end:s=>body=s},async()=>{throw new Error('internal details')});
 assert.equal(status,500);assert.equal(JSON.parse(body).error,'An unexpected server error occurred.');assert.ok(!body.includes('internal details'));
});
test('GPS country lookup uses the fixed postcode API and returns unknown when no country is found',async()=>{
 for(const country of ['England','Scotland','Wales','Northern Ireland',null]){
  const response=await handleAlertRequest(new Request('https://neighbour.test/api/alerts/location?lat=55.95&lon=-3.19&radius=25'),async url=>{const u=new URL(url);assert.equal(u.hostname,'api.postcodes.io');assert.equal(u.searchParams.get('lat'),'55.95');assert.equal(u.searchParams.get('radius'),'2000');return Response.json({result:country?[{country}]:null})});
  assert.equal(response.status,200);assert.equal((await response.json()).location.country,country);
 }
});
test('London dates and next-midnight scheduling handle both daylight-saving transitions',()=>{
 assert.equal(londonDate(Date.parse('2026-07-01T23:30:00Z')),'2026-07-02');
 assert.equal(new Date(nextLondonMidnight(Date.parse('2026-03-29T00:30:00Z'))).toISOString(),'2026-03-29T23:00:00.000Z');
 assert.equal(new Date(nextLondonMidnight(Date.parse('2026-10-25T00:30:00Z'))).toISOString(),'2026-10-26T00:00:00.000Z');
 assert.equal(new Date(nextLondonMidnight(Date.parse('2026-11-04T23:55:00Z'))).toISOString(),'2026-11-05T00:00:00.000Z');
});
test('yesterday never contributes forecast rows or weather advisories after London midnight',()=>{
 const base={high:12,low:4,code:0,uv:1,gust:10,precipitation:1};
 const days=[{...base,date:'2026-11-04',code:95},{...base,date:'2026-11-05'},{...base,date:'2026-11-07',high:40}];
 const now=Date.parse('2026-11-05T00:06:00Z');assert.deepEqual(upcomingForecast(days,now).map(d=>d.date),['2026-11-05','2026-11-07']);
 const result=weatherAdvisories(days,now);assert.equal(result.items.length,0);assert.ok(result.missing.length>0,'Missing tomorrow must not be treated as complete data');
});
