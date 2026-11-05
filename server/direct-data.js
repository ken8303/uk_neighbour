import {readerFor} from './upstream.js';
const stamp=result=>({checkedAt:result.meta.verifiedAt,freshness:result.meta});
const units={timezone:'Europe/London',temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm'};
export async function directData(type,location,radius,fetcher=fetch,code){
 const read=readerFor(fetcher);
 if(type==='location'){
  const url=new URL('https://api.postcodes.io/postcodes');url.search=new URLSearchParams({lat:location.lat,lon:location.lon,radius:2000,limit:1});
  const result=await read(url.href,'json',{validate:data=>{if(data?.result!==null&&!Array.isArray(data?.result))throw new Error('Invalid coverage lookup')}});
  const nearest=result.value.result?.[0];
  const country=typeof nearest?.country==='string'&&nearest.country.trim()?nearest.country:null;
  return {location:{...location,country,countrySource:country?'nearby-postcode':'unknown'},...stamp(result)};
 }
 if(type==='floods'){
  const url=new URL('https://environment.data.gov.uk/flood-monitoring/id/floods');url.search=new URLSearchParams({lat:location.lat,long:location.lon,dist:radius});
  const result=await read(url.href,'json',{validate:data=>{if(!Array.isArray(data?.items))throw new Error('Invalid flood response')}});
  return {items:result.value.items.filter(item=>[1,2,3].includes(Number(item.severityLevel))).sort((a,b)=>Number(a.severityLevel)-Number(b.severityLevel)),...stamp(result),coverage:'England only; empty results do not establish safety.'};
 }
 if(type==='flood-area'){
  if(!/^[a-z0-9_-]{1,100}$/i.test(code||''))throw new Error('Invalid flood area');
  const result=await read(`https://environment.data.gov.uk/flood-monitoring/id/floodAreas/${encodeURIComponent(code)}`,'json',{validate:data=>{if(!data?.items||typeof data.items!=='object')throw new Error('Invalid flood area')}});
  return {items:result.value.items,...stamp(result)};
 }
 if(type==='forecast'){
  const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:location.lat,longitude:location.lon,...units,daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_gusts_10m_max,precipitation_sum',forecast_days:7});
  const result=await read(url.href,'json',{validate:data=>{if(!Array.isArray(data?.daily?.time)||!data.daily.time.length||!Array.isArray(data.daily.temperature_2m_max)||!Array.isArray(data.daily.temperature_2m_min))throw new Error('Invalid forecast')}});
  const d=result.value.daily;
  return {days:d.time.map((date,i)=>({date,code:d.weather_code?.[i],high:d.temperature_2m_max[i],low:d.temperature_2m_min[i],rain:d.precipitation_probability_max?.[i],uv:d.uv_index_max?.[i],gust:d.wind_gusts_10m_max?.[i],precipitation:d.precipitation_sum?.[i]})),...stamp(result),coverage:'Model forecast for the selected coordinate; not an official warning.'};
 }
 if(type==='air'){
  const url=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');url.search=new URLSearchParams({latitude:location.lat,longitude:location.lon,current:'european_aqi,pm2_5,pm10',hourly:'european_aqi',forecast_days:2,timezone:'Europe/London',timeformat:'unixtime'});
  const result=await read(url.href,'json',{validate:data=>{if(!Number.isFinite(data?.current?.time)||!Number.isFinite(data.current.european_aqi)||data.current.european_aqi<0)throw new Error('Invalid air quality')}});
  return {current:result.value.current,hourly:result.value.hourly||{},...stamp(result),coverage:'CAMS model output, not a local sensor reading.'};
 }
 throw new Error('Unknown direct source');
}
export async function directPostcode(postcode,fetcher=fetch){
 const clean=String(postcode||'').replace(/\s/g,'').toUpperCase();
 if(!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(clean))return {status:400,body:{error:'Enter a valid UK postcode, such as SW1A 1AA.'}};
 const result=await readerFor(fetcher)(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`,'json',{notFound:true});
 const p=result.value?.result;
 if(!p)return {status:404,body:{error:'Postcode not found. Check it and try again.'}};
 if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))throw new Error('Invalid postcode coordinates');
 return {status:200,body:{location:{lat:p.latitude,lon:p.longitude,label:p.postcode,country:p.country,region:p.region||null},...stamp(result)}};
}
