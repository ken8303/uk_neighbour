import {readerFor} from './upstream.js';
import {distanceKm} from './feeds.js';
const centre={lat:51.5074,lon:-0.1278};
const modes={bus:'NaptanPublicBusCoachTram',rail:'NaptanMetroStation,NaptanRailStation'};
export const validStopId=id=>typeof id==='string'&&/^[a-z0-9]{5,32}$/i.test(id);
export function normaliseStops(data,location,kind){
 if(!Array.isArray(data?.stopPoints))throw new Error('Unexpected stop response');
 const unique=new Map();
 for(const stop of data.stopPoints){
  if(!stop||!validStopId(stop.id)||typeof stop.commonName!=='string'||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon)||Math.abs(stop.lat)>90||Math.abs(stop.lon)>180)continue;
  if(!Array.isArray(stop.modes)||!(kind==='bus'?stop.modes.includes('bus'):stop.modes.some(mode=>['tube','dlr','overground','elizabeth-line','tram','national-rail'].includes(mode))))continue;
  const distance=distanceKm(location,stop)*1000;
  if(distance>1000)continue;
  unique.set(stop.id,{id:stop.id,name:stop.commonName.slice(0,160),lat:stop.lat,lon:stop.lon,distanceMetres:Math.round(distance),modes:stop.modes.filter(m=>typeof m==='string').slice(0,8)});
 }
 const stops=[...unique.values()].sort((a,b)=>a.distanceMetres-b.distanceMetres||a.id.localeCompare(b.id));
 return {stops:stops.slice(0,10),total:stops.length,searchRadiusMetres:1000,sourceTotal:Number.isInteger(data.total)&&data.total>=data.stopPoints.length?data.total:null,partial:Number.isInteger(data.total)&&data.total>data.stopPoints.length};
}
export function normalisePredictions(data,stopId,now=Date.now()){
 if(!Array.isArray(data))throw new Error('Unexpected arrival response');
 const unique=new Map();let expiredReports=0;
 for(const prediction of data){
  if(!prediction||prediction.naptanId!==stopId)continue;
  const reported=Date.parse(prediction.timestamp),expected=Date.parse(prediction.expectedArrival),expires=Date.parse(prediction.timeToLive);
  if(!Number.isFinite(reported)||now-reported>120000||reported>now+30000){expiredReports++;continue;}
  if(!Number.isFinite(expected)||expected<now-15000||expected>now+7200000||(Number.isFinite(expires)&&expires<=now))continue;
  if(typeof prediction.lineName!=='string'||typeof prediction.destinationName!=='string')continue;
  const item={id:String(prediction.id||`${prediction.lineId}:${prediction.destinationName}:${expected}`),line:prediction.lineName.slice(0,80),destination:prediction.destinationName.slice(0,180),platform:typeof prediction.platformName==='string'?prediction.platformName.slice(0,60):null,expectedArrival:new Date(expected).toISOString(),reportedAt:new Date(reported).toISOString(),mode:typeof prediction.modeName==='string'?prediction.modeName:'unknown'};
  const old=unique.get(item.id);if(!old||item.reportedAt>old.reportedAt)unique.set(item.id,item);
 }
 if(data.length&&expiredReports===data.length)throw new Error('Arrival predictions are out of date');
 const predictions=[...unique.values()].sort((a,b)=>a.expectedArrival.localeCompare(b.expectedArrival));
 return {predictions:predictions.slice(0,10),total:predictions.length,excludedOldReports:expiredReports};
}
export async function getNearbyStops(location,kind='bus',fetcher=fetch){
 if(!Object.hasOwn(modes,kind))throw new Error('Invalid stop type');
 if(distanceKm(location,centre)>60)return {stops:[],total:0,coverageEligible:false,searchRadiusMetres:1000};
 const query=new URLSearchParams({lat:location.lat,lon:location.lon,stopTypes:modes[kind],radius:1000});
 // Location searches are not retained in the shared public-feed cache.
 const snapshot=await readerFor(fetcher)(`https://api.tfl.gov.uk/StopPoint?${query}`,'json',{validate:data=>normaliseStops(data,location,kind)});
 return {...normaliseStops(snapshot.value,location,kind),coverageEligible:true,checkedAt:snapshot.meta.verifiedAt,freshness:snapshot.meta};
}
export async function getDepartures(stopId,fetcher=fetch,now=Date.now()){
 if(!validStopId(stopId))throw new Error('Invalid stop identifier');
 // No per-stop server cache: predictions are short-lived and IDs are user-selected.
 const snapshot=await readerFor(fetcher)(`https://api.tfl.gov.uk/StopPoint/${encodeURIComponent(stopId)}/Arrivals`,'json',{validate:data=>normalisePredictions(data,stopId,now)});
 const result=normalisePredictions(snapshot.value,stopId,now);
 const sourceReportedAt=result.predictions.map(item=>item.reportedAt).sort()[0]||null;
 return {stopId,...result,checkedAt:snapshot.meta.verifiedAt,freshness:{...snapshot.meta,sourceUpdatedAt:sourceReportedAt}};
}
