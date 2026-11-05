import React,{useEffect,useState,useId} from 'react';
import {useLiveFeed,FeedFreshness} from './LiveFeeds';
async function readJSON(path,signal){
 const response=await fetch(path,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'TfL data is unavailable');return data;
}
function Expected({item,now,stale}){
 const time=Date.parse(item.expectedArrival),minutes=Math.ceil((time-now)/60000);
 return <span className="departure-time">{!stale&&minutes<=1?'Due':`${new Date(time).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})}`}{!stale&&minutes>1&&<small>in {minutes} min</small>}</span>;
}
export default function NearbyDepartures({location}){
 const id=useId();
 const [open,setOpen]=useState(false),[kind,setKind]=useState('bus'),[choice,setChoice]=useState(null),[now,setNow]=useState(Date.now);
 const key=location?`${location.lat}:${location.lon}:${kind}`:null;
 const stops=useLiveFeed({feedKey:open&&key?`stops:${key}`:null,interval:600000,retainFor:900000,load:async signal=>{
  const query=new URLSearchParams({lat:location.lat,lon:location.lon,radius:25,kind});
  const data=await readJSON(`/api/alerts/stops?${query}`,signal);if(!Array.isArray(data.stops))throw new Error('Unexpected stop data');return data;
 }});
 const options=stops.data?.stops||[];
 const selected=choice?.key===key&&options.some(stop=>stop.id===choice.id)?choice.id:options[0]?.id||'';
 const currentStop=options.find(stop=>stop.id===selected);
 const departures=useLiveFeed({feedKey:open&&selected&&key?`departures:${key}:${selected}`:null,interval:30000,retainFor:60000,load:async signal=>{
  const data=await readJSON(`/api/alerts/departures?${new URLSearchParams({stop:selected})}`,signal);
  if(data.stopId!==selected||!Array.isArray(data.predictions))throw new Error('Unexpected arrival data');return data;
 }});
 useEffect(()=>{if(!open)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[open]);
 const predictions=(departures.data?.predictions||[]).filter(item=>Number.isFinite(Date.parse(item.expectedArrival))&&Date.parse(item.expectedArrival)>=now-15000&&Number.isFinite(Date.parse(item.reportedAt))&&now-Date.parse(item.reportedAt)<=120000);
 return <details className="nearby-departures departure-board" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Nearby stops & live departures · London</summary>
 <p className="category-coverage">TfL arrival predictions for up to 10 nearby stops or stations within 1 km, using straight-line distance. Rail predictions cover available TfL services, not all National Rail departures. Times are estimates in Europe/London. Opening this board sends your search coordinates to TfL through our server.</p>
 {!location?<p className="source-status">Choose a location to find nearby stops.</p>:<>
 <label className="departure-label" htmlFor={`${id}-kind`}>Stop type</label><select className="departure-select" id={`${id}-kind`} value={kind} onChange={event=>{setKind(event.target.value);setChoice(null)}}><option value="bus">Bus stops</option><option value="rail">Rail stations</option></select>
 <button type="button" className="departure-refresh" disabled={stops.refreshing} onClick={stops.refresh}>Refresh nearby stops</button>
 {['idle','loading'].includes(stops.status)?<p className="source-status">Finding nearby stops…</p>:stops.status==='error'?<p className="source-unavailable">{stops.error}</p>:stops.data?.coverageEligible===false?<p className="source-status">Nearby TfL departures are not connected for this area. Use the national transport source links.</p>:options.length===0?<p className="source-status">No eligible TfL stops were returned within 1 km. This does not mean there are no local transport services.</p>:<>
 <FeedFreshness feed={stops}/>{stops.data.partial&&<p className="source-unavailable">The source returned only part of its stop list. Nearby-stop coverage may be incomplete.</p>}
 <label className="departure-label" htmlFor={`${id}-stop`}>Nearby stop</label><select className="departure-select" id={`${id}-stop`} value={selected} onChange={event=>setChoice({key,id:event.target.value})}>{options.map(stop=><option key={stop.id} value={stop.id}>{stop.name} · {stop.distanceMetres} m · {stop.id}</option>)}</select>
 <p className="category-coverage">{currentStop?.name} · {currentStop?.distanceMetres} m away · Stop {selected}. Check the stop name, direction and destination before travelling.</p>
 <button type="button" className="departure-refresh" disabled={departures.refreshing} onClick={departures.refresh}>Refresh departures</button><FeedFreshness feed={departures}/>
 <div aria-live="polite">{['idle','loading'].includes(departures.status)?<p className="source-status">Checking arrival predictions…</p>:departures.status==='error'?<p className="source-unavailable">{departures.error}</p>:predictions.length?<ul className="departure-list">{predictions.map(item=><li key={item.id}><div><strong>{item.line}</strong><span>{item.destination}</span>{item.platform&&<small>Platform / stop {item.platform}</small>}</div><Expected item={item} now={now} stale={departures.stale}/></li>)}</ul>:<p className="source-status">{departures.stale?'Previous predictions have expired. Current departures are unavailable.':'No fresh arrival predictions were returned for this stop. This does not mean no services are running.'}</p>}</div>
 {departures.data?.total>10&&<p className="category-coverage">Showing the next 10 predictions returned by TfL.</p>}
 </>}
 </>}
 <a href="https://tfl.gov.uk/plan-a-journey/" target="_blank" rel="noreferrer">Check TfL journey planner</a>
 </details>;
}
