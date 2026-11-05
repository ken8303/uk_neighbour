import {calendarDay,upcomingForecast} from './calendar.js';
export function airCategory(value){
 if(!Number.isFinite(value)||value<0)return 'Unavailable';
 return value<=20?'Good':value<=40?'Fair':value<=60?'Moderate':value<=80?'Poor':value<=100?'Very poor':'Extremely poor';
}
export function airOutlook(data,now=Date.now()){
 const current=data?.current;
 if(!Number.isFinite(current?.time)||!Number.isFinite(current?.european_aqi)||current.european_aqi<0||Math.abs(current.time*1000-now)>3*3600000)throw new Error('Air-quality data is stale or unavailable');
 const hours=data.hourly?.time||[],values=data.hourly?.european_aqi||[];
 const future=hours.flatMap((time,i)=>Number.isFinite(time)&&time*1000>=now&&time*1000<=now+24*3600000&&Number.isFinite(values[i])&&values[i]>=0?[values[i]]:[]);
 return {current:current.european_aqi,category:airCategory(current.european_aqi),peak:future.length?Math.max(...future):null,complete:future.length>=24,asOf:current.time};
}
export const thresholds='Next two forecast days: UV ≥3, high temperature ≥30°C, low ≤0°C, gust ≥60 km/h, daily rain ≥25 mm, or a snow, thunderstorm or freezing-rain weather code.';
export function weatherAdvisories(days,reference=Date.now()){
 const today=calendarDay(reference),tomorrow=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const selected=upcomingForecast(days,today).filter(day=>day.date<=tomorrow),items=[];
 const rules=[
  {id:'uv',test:d=>Number.isFinite(d.uv)&&d.uv>=3,title:'UV protection advised',detail:d=>`Maximum UV index ${d.uv.toFixed(1)}. Use sun protection when outdoors.`,metric:'uv'},
  {id:'heat',test:d=>Number.isFinite(d.high)&&d.high>=30,title:'Hot weather forecast',detail:d=>`High ${Math.round(d.high)}°C. Plan shade, water and breaks from heat.`,metric:'high'},
  {id:'cold',test:d=>Number.isFinite(d.low)&&d.low<=0,title:'Freezing temperatures forecast',detail:d=>`Low ${Math.round(d.low)}°C. Check travel conditions; air temperature alone does not determine road ice.`,metric:'low'},
  {id:'wind',test:d=>Number.isFinite(d.gust)&&d.gust>=60,title:'Strong wind gusts forecast',detail:d=>`Maximum gust ${Math.round(d.gust)} km/h. Check official warnings before exposed journeys.`,metric:'gust'},
  {id:'rain',test:d=>Number.isFinite(d.precipitation)&&d.precipitation>=25,title:'Heavy daily rain forecast',detail:d=>`${d.precipitation.toFixed(1)} mm forecast over the day. This does not predict whether flooding will occur.`,metric:'precipitation'},
  {id:'snow',test:d=>[71,73,75,77,85,86].includes(d.code),title:'Snow or snow showers forecast',detail:()=> 'Check official weather warnings and local travel conditions.'},
  {id:'thunder',test:d=>[95,96,99].includes(d.code),title:'Thunderstorms forecast',detail:()=> 'Plan shelter and check the Met Office for official warnings.'},
  {id:'freezing-rain',test:d=>[56,57,66,67].includes(d.code),title:'Freezing rain or drizzle forecast',detail:()=> 'Surfaces may become slippery. Check official travel and weather advice.'},
 ];
 for(const rule of rules){const day=selected.find(rule.test);if(day)items.push({id:rule.id,title:rule.title,date:day.date,description:rule.detail(day)})}
 const missing=[];
 for(const [field,label] of [['uv','UV'],['high','high temperature'],['low','low temperature'],['gust','wind gusts'],['precipitation','rainfall'],['code','weather conditions']])if(selected.length<2||selected.some(d=>!Number.isFinite(d[field])))missing.push(label);
 return {items,missing};
}
