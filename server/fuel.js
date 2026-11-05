import {parseLondonTime as parseFuelTime} from './source-time.js';
export {parseFuelTime};
import {createUpstreamReader} from './upstream.js';
import {distanceKm} from './feeds.js';
export const FUEL_TYPES=['E10','E5','B7'];
export const FUEL_SOURCES=[
 {id:'asda',name:'ASDA',url:'https://storelocator.asda.com/fuel_prices_data.json'},
 {id:'sainsburys',name:"Sainsbury’s",url:'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json'},
 {id:'morrisons',name:'Morrisons',url:'https://www.morrisons.com/fuel-prices/fuel.json'},
 {id:'tesco',name:'Tesco',url:'https://www.tesco.com/fuel_prices/fuel_prices_data.json'},
];
const ageLimit=24*3600000;
function recent(time,now){return Number.isFinite(time)&&time<=now+300000&&now-time<ageLimit}
function priceInPence(value){
 if(typeof value!=='number'&&!(typeof value==='string'&&/^\d+(?:\.\d{1,2})?$/.test(value.trim())))return null;
 const price=Number(value);return Number.isFinite(price)&&price>=50&&price<=500?Math.round(price*100)/100:null;
}
export function validateFuelPayload(data,now=Date.now()){
 if(!Array.isArray(data?.stations))throw new Error('Fuel feed has no station list');
 const time=parseFuelTime(data.last_updated);
 if(!recent(time,now))throw new Error('Fuel feed timestamp is missing, old or in the future');
 return time;
}
export function normaliseFuelStations(data,source,location,radius,fuel,now=Date.now()){
 const feedTime=validateFuelPayload(data,now),stations=[];let excluded=0;
 for(const station of data.stations){
  if(!station||typeof station!=='object')continue;
  const a=station.location?.latitude,b=station.location?.longitude;
  if(a===null||a===undefined||a===''||b===null||b===undefined||b==='')continue;
  const lat=Number(a),lon=Number(b);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))continue;
  const distance=distanceKm(location,{lat,lon});if(distance>radius)continue;
  if(station.prices?.[fuel]===undefined)continue;
  const price=priceInPence(station.prices[fuel]);
  const hasStationTime=station.last_updated!==undefined;
  const time=hasStationTime?parseFuelTime(station.last_updated):feedTime;
  if(price===null||!recent(time,now)){excluded++;continue;}
  const postcode=String(station.postcode||'').trim().toUpperCase().slice(0,12);
  stations.push({id:`${source.id}:${String(station.site_id||`${lat},${lon}`)}`,dedupe:`${postcode.replace(/\s/g,'')}:${lat.toFixed(4)}:${lon.toFixed(4)}`,brand:String(station.brand||source.name).slice(0,80),address:String(station.address||'Address not supplied').slice(0,220),postcode,lat,lon,pricePence:price,fuel,distanceKm:distance,reportedAt:new Date(time).toISOString(),timestampKind:hasStationTime?'station':'feed',source:source.name,sourceId:source.id});
 }
 return {stations,excluded,feedUpdatedAt:new Date(feedTime).toISOString()};
}
export function rankFuelStations(stations){
 const unique=new Map();
 for(const station of stations){
  const old=unique.get(station.dedupe);
  if(!old||station.reportedAt>old.station.reportedAt)unique.set(station.dedupe,{station,conflict:false});
  else if(station.reportedAt===old.station.reportedAt&&station.pricePence!==old.station.pricePence)old.conflict=true;
 }
 const entries=[...unique.values()];
 return {stations:entries.filter(v=>!v.conflict).map(v=>{const {dedupe,...station}=v.station;return station}).sort((a,b)=>a.pricePence-b.pricePence||a.distanceKm-b.distanceKm||a.id.localeCompare(b.id)),conflicts:entries.filter(v=>v.conflict).length};
}
const readers=new WeakMap();
export async function getFuelPrices(location,radius,fuel='E10',fetcher=fetch,sources=FUEL_SOURCES,now=Date.now()){
 if(!FUEL_TYPES.includes(fuel))throw new Error('Invalid fuel grade');
 if(!readers.has(fetcher))readers.set(fetcher,createUpstreamReader({fetcher,ttl:300000,maxAge:300000}));
 const read=readers.get(fetcher);
 const results=await Promise.all(sources.map(async source=>{
  try{
   const snapshot=await read(source.url,'json',{cacheable:true,validate:data=>validateFuelPayload(data,now)});
   const data=normaliseFuelStations(snapshot.value,source,location,radius,fuel,now);
   return {source:{id:source.id,name:source.name,status:snapshot.meta.state==='stale'?'stale':'connected',feedUpdatedAt:data.feedUpdatedAt},stations:data.stations,excluded:data.excluded,meta:snapshot.meta};
  }catch{return {source:{id:source.id,name:source.name,status:'unavailable'},stations:[],excluded:0};}
 }));
 const available=results.filter(r=>r.meta),ranked=rankFuelStations(available.flatMap(r=>r.stations));
 const meta=available.length?available.map(r=>r.meta).sort((a,b)=>a.verifiedAt.localeCompare(b.verifiedAt))[0]:null;
 return {fuel,stations:ranked.stations.slice(0,10),total:ranked.stations.length,conflicts:ranked.conflicts,excluded:results.reduce((sum,r)=>sum+r.excluded,0),sources:results.map(r=>r.source),availability:available.length?'available':'unavailable',partial:available.length<sources.length,checkedAt:meta?.verifiedAt||null,freshness:meta?{...meta,state:available.some(r=>r.meta.state==='stale')?'stale':'fresh',cache:available.every(r=>r.meta.cache==='hit')?'hit':'mixed',sourceUpdatedAt:null,cacheTtlSeconds:300}:null,coverage:'Lowest among fresh reports from connected retailer feeds, not every UK station.'};
}
