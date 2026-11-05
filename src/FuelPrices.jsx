import React,{useState} from 'react';
import {Fuel,RefreshCw,ArrowUpRight} from 'lucide-react';
import {useLiveFeed,FeedFreshness} from './LiveFeeds';
const labels={E10:'E10 petrol',E5:'E5 premium petrol',B7:'B7 diesel'};
const price=value=>new Intl.NumberFormat('en-GB',{minimumFractionDigits:1,maximumFractionDigits:2}).format(value);
function Reported({station}){return <span>{station.timestampKind==='station'?'Report updated':'Feed updated'} {new Date(station.reportedAt).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · {station.source}</span>}
function Directions({station}){return <a href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`} target="_blank" rel="noreferrer" aria-label={`Directions to ${station.brand}, ${station.postcode}`}>Directions<ArrowUpRight size={14}/></a>}
export default function FuelPrices({location,radius}){
 const [fuel,setFuel]=useState('E10');
 const feed=useLiveFeed({feedKey:location?`fuel:${location.lat}:${location.lon}:${radius}:${fuel}`:null,interval:300000,retainFor:600000,load:async signal=>{
  const params=new URLSearchParams({lat:location.lat,lon:location.lon,radius,fuel});
  const response=await fetch(`/api/alerts/fuel?${params}`,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
  const data=await response.json();
  if(!response.ok||data.availability==='unavailable')throw new Error(data.error||'Fuel-price sources are unavailable.');
  if(!Array.isArray(data.stations))throw new Error('Invalid fuel-price response');
  return data;
 }});
 const data=feed.data,cheapest=data?.stations?.[0];
 return <section className="panel fuel-prices" aria-busy={feed.refreshing}>
 <div className="result-heading"><h2><Fuel size={22}/>Cheapest nearby fuel</h2>{location&&<button className="refresh" disabled={feed.refreshing} onClick={feed.refresh} aria-label="Refresh fuel prices"><RefreshCw size={18}/></button>}</div>
 <div className="fuel-controls"><label htmlFor="fuel-grade">Fuel type</label><select id="fuel-grade" value={fuel} onChange={e=>setFuel(e.target.value)}>{Object.entries(labels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></div>
 <p className="category-coverage">Compare {labels[fuel]} within {radius} km. Only reports updated within 24 hours qualify. Distances are straight-line distances.</p>
 <FeedFreshness feed={feed}/>
 <div aria-live="polite">{!location?<p className="source-status">Choose a location to compare nearby station prices.</p>:['idle','loading'].includes(feed.status)?<p className="source-status">Checking retailer price reports…</p>:feed.status==='error'?<p className="source-unavailable">{feed.error||'Fuel prices are unavailable. No current cheapest price can be calculated.'}</p>:<>
 {data.partial&&<p className="source-unavailable">Some retailer feeds are unavailable. This comparison has partial coverage.</p>}
 {cheapest?<><div className="cheapest-fuel"><span>{feed.stale?'Previous lowest reported price':'Lowest reported price'} · {labels[fuel]}</span><p><strong>{price(cheapest.pricePence)}p</strong><span>per litre</span></p><h3>{cheapest.brand}</h3><p className="station-address">{cheapest.address} · {cheapest.postcode}</p><p className="fuel-distance">{cheapest.distanceKm.toFixed(1)} km away</p><p className="fuel-report"><Reported station={cheapest}/></p><Directions station={cheapest}/></div>
 {data.stations.length>1&&<details className="fuel-comparison"><summary>Compare {data.stations.length} reported stations</summary><ol>{data.stations.map(station=><li key={station.id}><div className="station-heading"><strong>{station.brand}</strong><strong>{price(station.pricePence)}p/l</strong></div><p>{station.address} · {station.postcode}</p><p>{station.distanceKm.toFixed(1)} km · <Reported station={station}/></p><Directions station={station}/></li>)}</ol></details>}
 <p className="category-coverage">{data.total>10?'Showing the 10 lowest-priced reports. ':''}Lowest among reporting stations in the connected feeds, not every station in the area. Check the pump price before filling up.</p></>:<p className="source-status">No qualifying {labels[fuel]} prices were reported within this radius by the connected feeds. This does not mean there are no nearby stations.</p>}
 {(data.conflicts>0||data.excluded>0)&&<p className="category-coverage">Some reports were excluded because prices, dates or duplicate reports could not be trusted.</p>}
 <details className="fuel-sources"><summary>Price-source coverage</summary><ul>{data.sources?.map(source=><li key={source.id}><strong>{source.name}</strong><span>{source.status==='connected'?'Feed connected':source.status==='stale'?'Previous feed':'Unavailable'}</span></li>)}</ul></details>
 </>}</div>
 <p className="fuel-attribution">Public retailer reports. Feed timestamps may differ from the time a pump price last changed. Live source access is awaiting verification in this environment.</p>
 </section>;
}
