import { XMLParser } from 'fast-xml-parser';

export const SOURCES = {
 weather: 'https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/UK',
 traffic: 'https://api.tfl.gov.uk/Road/All/Disruption',
 safety: 'https://data.police.uk/api/',
};
const text = value => String(value?.['#text'] ?? value ?? '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function safeSourceLink(value, suffix, fallback) {
 try {const url=new URL(text(value)); if(['http:','https:'].includes(url.protocol)&&(url.hostname===suffix||url.hostname.endsWith('.'+suffix))){url.protocol='https:';url.username='';url.password='';return url.href;}} catch {}
 return fallback;
}
export function distanceKm(a,b) {
 const rad=Math.PI/180, dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function polygonNear(polygon, location, radius) {
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if(((a.lat>location.lat)!==(b.lat>location.lat))&&(location.lon<(b.lon-a.lon)*(location.lat-a.lat)/(b.lat-a.lat)+a.lon))inside=!inside;
 }
 if(inside)return true;
 const scale=Math.cos(location.lat*Math.PI/180);
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length];
  const ax=(p.lon-location.lon)*111.195*scale,ay=(p.lat-location.lat)*111.195;
  const bx=(q.lon-location.lon)*111.195*scale,by=(q.lat-location.lat)*111.195;
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len)):0;
  if(Math.hypot(ax+t*dx,ay+t*dy)<=radius)return true;
 }
 return false;
}
function readPolygon(value){
 const numbers=text(value).split(/\s+/).map(Number);
 if(numbers.length<6||numbers.length%2||numbers.some(n=>!Number.isFinite(n)))return null;
 const points=[];for(let i=0;i<numbers.length;i+=2){if(Math.abs(numbers[i])>90||Math.abs(numbers[i+1])>180)return null;points.push({lat:numbers[i],lon:numbers[i+1]});}return points;
}
export function parseWeather(xml,location,radius){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Unsupported XML declaration');
 const data=new XMLParser({ignoreAttributes:false,processEntities:true}).parse(xml);
 const channel=data?.rss?.channel;
 if(!channel||!channel.title)throw new Error('Unexpected weather feed format');
 const raw=channel.item==null?[]:Array.isArray(channel.item)?channel.item:[channel.item];
 const items=raw.filter(item=>!/^no (?:severe )?(?:weather )?warnings/i.test(text(item.title))).map(item=>{
  const polygon=readPolygon(item['georss:polygon']);
  return {id:text(item.guid)||text(item.link)||text(item.title),title:text(item.title).slice(0,250),description:text(item.description).slice(0,1200),issued:text(item.pubDate)||null,severity:/\bred\b/i.test(text(item.title))?'Red':/\bamber\b/i.test(text(item.title))?'Amber':/\byellow\b/i.test(text(item.title))?'Yellow':'Warning',scope:polygon?'Matched to your search area':'UK feed · location not supplied',link:safeSourceLink(item.link,'metoffice.gov.uk','https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings'),polygon};
 }).filter(item=>!item.polygon||polygonNear(item.polygon,location,radius));
 return items.map(({polygon,...item})=>item);
}
function coordinates(value){try{const p=typeof value==='string'?JSON.parse(value):value;return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90?{lon:p[0],lat:p[1]}:null;}catch{return null;}}
export function parseTraffic(data,location,radius,now=Date.now()) {
 if(!Array.isArray(data))throw new Error('Unexpected traffic feed format');
 return data.flatMap(item=>{
  if(!item||typeof item!=='object')return [];
  const start=Date.parse(item.startDateTime),end=Date.parse(item.endDateTime);
  if((Number.isFinite(start)&&start>now)||(Number.isFinite(end)&&end<now)||/resolved|cleared|ended/i.test(item.status||''))return [];
  const point=coordinates(item.point);
  if(!point||distanceKm(location,point)>radius)return [];
  return [{id:String(item.id),title:text(item.location||item.corridor||'Road disruption').slice(0,250),description:text(item.comments||item.currentUpdate||item.category).slice(0,1200),severity:text(item.severity)||'Disruption',category:text(item.subCategory||item.category)||'Traffic disruption',scope:'TfL London roads · reported point within radius',updated:item.lastModifiedTime||null,lat:point.lat,lon:point.lon,link:'https://tfl.gov.uk/traffic/status/'}];
 });
}
const cache=new Map();
async function upstream(url,format,fetcher,{cacheable=false,notFound=false}={}){
 const cached=cacheable&&cache.get(url);
 if(cached&&cached.expires>Date.now())return cached.value;
 const response=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:{Accept:format==='xml'?'application/rss+xml, application/xml, text/xml':'application/json'}});
 if(notFound&&response.status===404)return null;
 if(!response.ok)throw new Error(`Provider unavailable (${response.status})`);
 const value=format==='xml'?await response.text():await response.json();
 if(cacheable)cache.set(url,{value,expires:Date.now()+60000});
 return value;
}
export async function getFeed(type,location,radius,fetcher=fetch){
 const checkedAt=new Date().toISOString();
 if(type==='weather')return {items:parseWeather(await upstream(SOURCES.weather,'xml',fetcher,{cacheable:true}),location,radius),checkedAt,coverage:'Met Office UK warning feed; only warnings with published polygons can be matched to your radius.'};
 if(type==='traffic')return {items:parseTraffic(await upstream(SOURCES.traffic,'json',fetcher,{cacheable:true}),location,radius),checkedAt,coverage:'TfL London roads only. Closures and disruptions elsewhere are not included.'};
 if(type==='safety'){
  const found=await upstream(`${SOURCES.safety}locate-neighbourhood?q=${location.lat},${location.lon}`,'json',fetcher,{notFound:true});
  if(!found)return {neighbourhood:null,checkedAt};
  if(!/^[a-z0-9_-]+$/i.test(found.force)||!/^[a-z0-9_-]+$/i.test(found.neighbourhood))throw new Error('Unexpected neighbourhood response');
  const detail=await upstream(`${SOURCES.safety}${encodeURIComponent(found.force)}/${encodeURIComponent(found.neighbourhood)}`,'json',fetcher);
  if(!detail||typeof detail.name!=='string')throw new Error('Unexpected neighbourhood detail');
  return {neighbourhood:{name:detail.name,link:safeSourceLink(detail.url_force,'police.uk','https://www.police.uk/pu/your-area/')},checkedAt};
 }
 throw new Error('Unknown feed');
}
