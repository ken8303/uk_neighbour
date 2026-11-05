import data from '../public/data/gb-rail-stations.json' with {type:'json'};
import {distanceKm} from './feeds.js';
export const railDataset={revision:'67dff87f51bdb782ddfcce1d8b10a88f059bf380',sourceUpdated:'2026-10-07',source:'https://github.com/davwheat/uk-railway-stations',licence:'ODbL 1.0',download:'/data/gb-rail-stations.json',attribution:'/data/gb-rail-stations-SOURCE.md'};
const fold=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const stations=data.filter(station=>/^[A-Z]{3}$/.test(station.crsCode)&&typeof station.stationName==='string'&&Number.isFinite(station.lat)&&Number.isFinite(station.long)&&['england','scotland','wales'].includes(station.constituentCountry)).map(station=>({code:station.crsCode,name:station.stationName,lat:station.lat,lon:station.long,country:station.constituentCountry,search:fold(station.stationName)}));
export function findRailStations({query='',location=null,radius=25}={}){
 const term=fold(query.trim());
 if(query&&(query.trim().length>80||term.length<2))throw new Error('Use at least two letters or a three-letter CRS code, up to 80 characters.');
 if(!term&&!location)throw new Error('A location or station search is required');
 const matching=stations.filter(station=>term?(station.search.includes(term)||station.code.toLowerCase()===term):distanceKm(location,station)<=radius);
 const ordered=matching.map(station=>({...station,...(location?{distanceKm:distanceKm(location,station)}:{})})).sort((a,b)=>{
  if(!term)return a.distanceKm-b.distanceKm||a.name.localeCompare(b.name);
  const score=station=>station.code.toLowerCase()===term?0:station.search===term?1:station.search.startsWith(term)?2:3;
  return score(a)-score(b)||a.name.localeCompare(b.name);
 });
 return {stations:ordered.slice(0,20).map(({search,...station})=>station),total:ordered.length,mode:term?'search':'nearby',dataset:railDataset,liveDeparturesConnected:false};
}
