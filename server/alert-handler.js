import {findRailStations} from './rail-stations.js';
import {getCycleHire,getJourneys} from './transport-tools.js';
import {getNearbyStops,getDepartures,validStopId} from './departures.js';
import {getFuelPrices,FUEL_TYPES} from './fuel.js';
import { getFeed } from './feeds.js';
import {directData,directPostcode} from './direct-data.js';
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...headers,...extra}})}

// Shared by the Node server, Vite, and Cloudflare's Fetch runtime.
export async function handleAlertRequest(request, fetcher=fetch){
 let url;
 try{url=new URL(request.url)}catch{return json({error:'Invalid URL'},400)}
 if(url.pathname!=='/api'&&!url.pathname.startsWith('/api/'))return null;
 if(request.method!=='GET')return json({error:'GET required'},405,{Allow:'GET'});
 const prefix='/api/alerts/';
 const type=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):'';
 if(!['weather','traffic','highways','safety','transport','buses','stops','departures','cycle-hire','journey','rail-stations','location','fuel','postcode','floods','flood-area','forecast','air'].includes(type))return json({error:'Unknown alert category'},404);
 if(type==='postcode'){try{const result=await directPostcode(url.searchParams.get('postcode'),fetcher);return json(result.body,result.status)}catch{return json({error:'Postcode lookup is unavailable. Please try again.'},502)}}
 if(type==='rail-stations'&&url.searchParams.has('search')){
  try{return json(findRailStations({query:url.searchParams.get('search')}))}catch{return json({error:'Enter at least two letters of a station name or a three-letter CRS code, up to 80 characters.'},400)}
 }
 if(type==='departures'){
  const stop=url.searchParams.get('stop');if(!validStopId(stop))return json({error:'Valid TfL stop identifier required'},400);
  try{return json(await getDepartures(stop,fetcher))}catch{return json({error:'TfL arrival predictions are unavailable or out of date. Check TfL before travelling.'},502)}
 }
 const rawLat=url.searchParams.get('lat'),rawLon=url.searchParams.get('lon');
 const lat=Number(rawLat),lon=Number(rawLon),radius=Number(url.searchParams.get('radius'));
 if(!rawLat?.trim()||!rawLon?.trim()||![lat,lon,radius].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||![10,25,50].includes(radius)){
  return json({error:'Valid coordinates and radius (10, 25, or 50 km) are required.'},400);
 }
 if(type==='rail-stations')return json(findRailStations({location:{lat,lon},radius}));
 if(type==='cycle-hire'){
  try{return json(await getCycleHire({lat,lon},fetcher))}catch{return json({error:'Cycle-hire availability is unavailable. Check TfL before travelling.'},502)}
 }
 if(type==='journey'){
  const rawToLat=url.searchParams.get('toLat'),rawToLon=url.searchParams.get('toLon'),toLat=Number(rawToLat),toLon=Number(rawToLon);
  if(!rawToLat?.trim()||!rawToLon?.trim()||!Number.isFinite(toLat)||!Number.isFinite(toLon)||Math.abs(toLat)>90||Math.abs(toLon)>180)return json({error:'Valid destination coordinates required'},400);
  try{return json(await getJourneys({lat,lon},{lat:toLat,lon:toLon},fetcher))}catch{return json({error:'Journey planning is unavailable or returned no current valid route. Check TfL.'},502)}
 }
 if(type==='stops'){
  const kind=url.searchParams.get('kind')||'bus';if(!['bus','rail'].includes(kind))return json({error:'Stop type must be bus or rail'},400);
  try{return json(await getNearbyStops({lat,lon},kind,fetcher))}catch{return json({error:'Nearby TfL stops are unavailable. Check the official journey planner.'},502)}
 }
 if(type==='fuel'){const grade=url.searchParams.get('fuel')||'E10';if(!FUEL_TYPES.includes(grade))return json({error:'Fuel must be E10, E5 or B7'},400);const result=await getFuelPrices({lat,lon},radius,grade,fetcher);return json(result.availability==='unavailable'?{...result,error:'Fuel-price feeds are unavailable. No current cheapest price can be calculated.'}:result,result.availability==='unavailable'?502:200);}
 if(type==='flood-area'&&!/^[a-z0-9_-]{1,100}$/i.test(url.searchParams.get('code')||''))return json({error:'Valid flood-area code required'},400);
 try{return json(await (['location','floods','flood-area','forecast','air'].includes(type)?directData(type,{lat,lon},radius,fetcher,url.searchParams.get('code')):getFeed(type,{lat,lon},radius,fetcher)))}
 catch{return json({error:'This official service is unavailable. Use the source link or try again later.'},502)}
}
