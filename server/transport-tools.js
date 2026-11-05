import {readerFor} from './upstream.js';
import {distanceKm} from './feeds.js';
import {parseLondonTime} from './source-time.js';
const centre={lat:51.5074,lon:-0.1278};
const count=value=>typeof value==='string'&&/^\d{1,4}$/.test(value)?Number(value):null;
const clean=value=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,600):'';
export function normaliseCycleHire(data,location,now=Date.now()){
 if(!Array.isArray(data))throw new Error('Unexpected cycle-hire data');
 let excluded=0;const stations=new Map();
 for(const item of data){
  if(!item||!/^BikePoints_\d+$/.test(item.id)||!Number.isFinite(item.lat)||!Number.isFinite(item.lon)||Math.abs(item.lat)>90||Math.abs(item.lon)>180)continue;
  const distance=distanceKm(location,item)*1000;if(distance>1000)continue;
  const properties=new Map((Array.isArray(item.additionalProperties)?item.additionalProperties:[]).filter(p=>p&&typeof p.key==='string').map(p=>[p.key,p]));
  if(properties.get('Installed')?.value!=='true'||properties.get('Locked')?.value!=='false'){excluded++;continue;}
  const keys=['NbBikes','NbEmptyDocks','NbDocks'];
  const [bikes,emptyDocks,docks]=keys.map(key=>count(properties.get(key)?.value));
  const stamps=[...keys,'Installed','Locked'].map(key=>Date.parse(properties.get(key)?.modified));
  if([bikes,emptyDocks,docks].some(v=>v===null)||bikes+emptyDocks>docks||docks===0||stamps.some(time=>!Number.isFinite(time)||now-time>300000||time>now+30000)){excluded++;continue;}
  stations.set(item.id,{id:item.id,name:clean(item.commonName)||'Cycle-hire station',lat:item.lat,lon:item.lon,distanceMetres:Math.round(distance),bikes,emptyDocks,docks,reportedAt:new Date(Math.min(...stamps)).toISOString()});
 }
 const nearby=[...stations.values()].sort((a,b)=>a.distanceMetres-b.distanceMetres);
 return {stations:nearby.slice(0,10),total:nearby.length,excluded,searchRadiusMetres:1000};
}
export async function getCycleHire(location,fetcher=fetch,now=Date.now()){
 if(distanceKm(location,centre)>60)return {stations:[],total:0,coverageEligible:false};
 const snapshot=await readerFor(fetcher)('https://api.tfl.gov.uk/BikePoint','json',{cacheable:true,validate:data=>{if(!Array.isArray(data))throw new Error('Unexpected cycle-hire data')}});
 const result=normaliseCycleHire(snapshot.value,location,now);
 return {...result,coverageEligible:true,freshness:{...snapshot.meta,sourceUpdatedAt:result.stations.map(station=>station.reportedAt).sort()[0]||null}};
}
export function normaliseJourneys(data,now=Date.now()){
 if(!Array.isArray(data?.journeys))throw new Error('Unexpected journey response');
 const journeys=data.journeys.flatMap((journey,index)=>{
  if(!journey||!Number.isFinite(journey.duration)||journey.duration<=0||!Array.isArray(journey.legs)||!journey.legs.length||journey.legs.length>30)return [];
  const start=parseLondonTime(journey.startDateTime),arrival=parseLondonTime(journey.arrivalDateTime);
  if(!Number.isFinite(start)||!Number.isFinite(arrival)||start<now-300000||start>now+86400000||arrival<start||arrival<=now)return [];
  const legs=journey.legs.map(leg=>({summary:clean(leg?.instruction?.summary),mode:clean(leg?.mode?.name||leg?.mode?.id),duration:leg?.duration,from:clean(leg?.departurePoint?.commonName),to:clean(leg?.arrivalPoint?.commonName),disrupted:leg?.isDisrupted===true,notices:[...(Array.isArray(leg?.disruptions)?leg.disruptions:[]),...(Array.isArray(leg?.plannedWorks)?leg.plannedWorks:[])].map(notice=>clean(notice?.description||notice?.summary||notice?.name)).filter(Boolean).slice(0,5)}));
  // Never silently omit a malformed leg and present a partial route as complete.
  if(legs.some(leg=>!leg.summary||!Number.isFinite(leg.duration)||leg.duration<0))return [];
  return [{id:String(index),duration:journey.duration,start:new Date(start).toISOString(),arrival:new Date(arrival).toISOString(),legs}];
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.duration-b.duration);
 if(data.journeys.length&&!journeys.length)throw new Error('No current valid journeys were returned');
 return {journeys:journeys.slice(0,3),total:journeys.length};
}
export async function getJourneys(from,to,fetcher=fetch,now=Date.now()){
 if([from,to].some(point=>distanceKm(point,centre)>60))return {journeys:[],total:0,coverageEligible:false};
 const url=`https://api.tfl.gov.uk/Journey/JourneyResults/${from.lat},${from.lon}/to/${to.lat},${to.lon}`;
 // Route coordinates and journey responses are not retained in the server cache.
 const snapshot=await readerFor(fetcher)(url,'json',{validate:data=>normaliseJourneys(data,now)});
 return {...normaliseJourneys(snapshot.value,now),coverageEligible:true,freshness:snapshot.meta};
}
