import {readerFor} from './upstream.js';
import {distanceKm} from './feeds.js';
export const UTILITY_SOURCES={power:'https://external.distribution.prd.ssen.co.uk/opendataportal-prd/v4/api/getallfaults',water:'https://www.thameswater.co.uk/network-latest'};
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export function parsePower(data,location,radius){
 const rows=Array.isArray(data)?data:data?.faults;
 if(!Array.isArray(rows))throw new Error('Unrecognised SSEN response');
 let unlocatedCount=0;
 const items=rows.flatMap(row=>{
  if(!row||typeof row!=='object')throw new Error('Invalid fault');
  const f=Object.fromEntries(Object.entries(row).map(([k,v])=>[k.toLowerCase(),v]));
  const reference=f.faultreference||f.faultreferencenumber||f.reference;
  // Reject schema changes rather than misreporting an empty outage list.
  if(!reference)throw new Error('Missing fault reference');
  if(/^(restored|resolved|closed)$/i.test(String(f.status||f.faultstatus||'')))return [];
  const lat=Number(f.latitude),lon=Number(f.longitude);
  if(f.latitude==null||f.longitude==null||f.latitude===''||f.longitude===''||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){unlocatedCount++;return [];}
  if(distanceKm(location,{lat,lon})>radius)return [];
  return [{id:String(reference),title:`SSEN power report ${clean(reference)}`,severity:clean(f.faulttype||'Power report'),description:clean(f.description||f.faultdescription||'Check SSEN for current details and estimated restoration.').slice(0,1500),scope:'SSEN reported point within radius · does not confirm your property is affected',link:'https://powertrack.ssen.co.uk/powertrack'}];
 });
 return {items,unlocatedCount};
}
export function parseWater(html){
 if(typeof html!=='string'||!/<h1\b[^>]*>\s*Incidents\s*<\/h1>/i.test(html))throw new Error('Unrecognised Thames Water incident page');
 const items=new Map();
 for(const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  let link;try{link=new URL(match[2],UTILITY_SOURCES.water)}catch{continue;}
  if(link.protocol!=='https:'||link.hostname!=='www.thameswater.co.uk'||!link.pathname.startsWith('/network-latest/'))continue;
  const title=clean(match[3]);
  if(!title||!/\b(?:[A-Z]{1,2}\d[A-Z\d]?)\b/i.test(title))continue;
  items.set(link.href,{id:link.href,title:title.slice(0,250),severity:'Water report',scope:'Thames Water published incident · postcode district in title; not a radius or property match',link:link.href});
 }
 // An empty/changed page must not silently become an all-clear.
 if(!items.size)throw new Error('No recognisable incident listing; check Thames Water directly');
 return [...items.values()];
}
export async function getUtilityFeed(type,location,radius,postcode,fetcher=fetch){
 // Initial provider coverage is explicitly limited to the requested Reading district.
 if(!/^RG1\s?\d[A-Z]{2}$/i.test(postcode||''))return {items:[],coverageEligible:false};
 const power=type==='power',parse=value=>power?parsePower(value,location,radius):{items:parseWater(value)};
 const result=await readerFor(fetcher)(UTILITY_SOURCES[type],power?'json':'xml',{cacheable:true,validate:parse});
 const parsed=parse(result.value);
 if(!power)parsed.items=parsed.items.filter(item=>/\bRG1\b/i.test(item.title));
 return {...parsed,coverageEligible:true,checkedAt:result.meta.verifiedAt,freshness:result.meta};
}
