import React,{useEffect,useId,useRef,useState} from 'react';
import {useLiveFeed,FeedFreshness} from './LiveFeeds';
import {lookupPostcode} from './api';
async function read(path,signal){
 const response=await fetch(path,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'TfL data unavailable');return data;
}
const clock=value=>new Date(value).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
function useBoardClock(active){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{if(!active)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[active]);
 return now;
}
export function NearbyCycleHire({location}){
 const [open,setOpen]=useState(false);
 const now=useBoardClock(open);
 const feed=useLiveFeed({feedKey:open&&location?`cycles:${location.lat}:${location.lon}`:null,interval:60000,retainFor:120000,load:async signal=>{
  const data=await read(`/api/alerts/cycle-hire?${new URLSearchParams({lat:location.lat,lon:location.lon,radius:25})}`,signal);
  if(!Array.isArray(data.stations))throw new Error('Unexpected cycle-hire response');return data;
 }});
 const stations=(feed.data?.stations||[]).filter(station=>{const stamp=Date.parse(station.reportedAt);return Number.isFinite(stamp)&&now-stamp<=300000&&stamp<=now+30000});
 return <details className="nearby-departures cycle-hire" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Nearby cycle-hire availability · London</summary>
 <p className="category-coverage">Santander Cycles stations within 1 km by straight-line distance. Numbers can change before you arrive; bikes and spaces are not reserved. Reports older than five minutes are excluded.</p>
 {!location?<p className="source-status">Choose a location to find cycle-hire stations.</p>:<><button type="button" className="departure-refresh" onClick={feed.refresh} disabled={feed.refreshing}>Refresh cycle hire</button><FeedFreshness feed={feed}/>
 {['idle','loading'].includes(feed.status)?<p className="source-status">Checking cycle-hire stations…</p>:feed.status==='error'?<p className="source-unavailable">{feed.error}</p>:feed.data?.coverageEligible===false?<p className="source-status">This cycle-hire feed does not cover the selected area.</p>:<>
 {feed.data.excluded>0&&<p className="source-unavailable">Some nearby stations were excluded because they are closed, locked, or have missing, inconsistent or outdated reports.</p>}
 {stations.length<feed.data.stations.length&&<p className="source-unavailable">Some previous station reports have expired. Refresh to check availability.</p>}
 {stations.length?<ul className="cycle-stations">{stations.map(station=><li key={station.id}><h4>{station.name}</h4><p>{station.distanceMetres} m away · {feed.stale?'Previously reported':'Reported'} {clock(station.reportedAt)} Europe/London</p><p><strong>{station.bikes} bikes</strong> · <strong>{station.emptyDocks} empty docking spaces</strong></p><a href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`} target="_blank" rel="noreferrer">Directions to {station.name}</a></li>)}</ul>:<p className="source-status">No qualifying stations were returned within 1 km. Missing data does not mean there are no stations or bikes nearby.</p>}
 {feed.data.total>10&&<p className="category-coverage">Showing the 10 nearest reported stations.</p>}
 </>}</>}
 <a href="https://tfl.gov.uk/modes/cycling/santander-cycles" target="_blank" rel="noreferrer">Check Santander Cycles</a></details>;
}
export function JourneyPlanner({location}){
 const id=useId(),[open,setOpen]=useState(false),[postcode,setPostcode]=useState(''),[request,setRequest]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),controller=useRef(null);
 const now=useBoardClock(open);
 const origin=location?`${location.lat}:${location.lon}`:null;
 useEffect(()=>{controller.current?.abort();setRequest(null);setBusy(false);setError(null);return()=>controller.current?.abort()},[origin,open]);
 const feed=useLiveFeed({feedKey:open&&request?.origin===origin?`journey:${origin}:${request.to.lat}:${request.to.lon}:${request.sequence}`:null,interval:120000,retainFor:120000,load:async signal=>{
  const params=new URLSearchParams({lat:location.lat,lon:location.lon,radius:25,toLat:request.to.lat,toLon:request.to.lon});
  const data=await read(`/api/alerts/journey?${params}`,signal);if(!Array.isArray(data.journeys))throw new Error('Unexpected journey response');return data;
 }});
 async function plan(event){
  event.preventDefault();if(!location)return;
  controller.current?.abort();const pending=new AbortController();controller.current=pending;setBusy(true);setError(null);setRequest(null);
  try{const to=await lookupPostcode(postcode,pending.signal);if(!pending.signal.aborted)setRequest({origin,to,sequence:Date.now()});}
  catch(error){if(!pending.signal.aborted)setError(error.message)}finally{if(!pending.signal.aborted)setBusy(false)}
 }
 return <details className="nearby-departures journey-planner" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Plan a public transport journey · London</summary>
 <p className="category-coverage">Plan from your selected location to a UK destination postcode. This integration is limited to journeys starting and ending in the London area. Times are TfL estimates in Europe/London. Routes are not guaranteed accessible; check TfL for access requirements.</p>
 {!location?<p className="source-status">Choose your starting location first.</p>:<>
 <p className="category-coverage">Submitting sends the destination postcode to Postcodes.io and the origin and destination coordinates to TfL through our server.</p>
 <form onSubmit={plan}><label className="departure-label" htmlFor={`${id}-destination`}>Destination postcode</label><input className="journey-postcode" id={`${id}-destination`} value={postcode} onChange={event=>setPostcode(event.target.value)} autoComplete="postal-code" maxLength={12} placeholder="For example, EC1A 1BB"/><button type="submit" className="departure-refresh" disabled={busy||feed.refreshing}>{busy?'Finding destination…':'Plan journey'}</button></form>
 {error&&<p className="source-unavailable" role="alert">{error}</p>}
 {request&&request.origin===origin&&<><FeedFreshness feed={feed}/><div aria-live="polite">{['idle','loading'].includes(feed.status)?<p className="source-status">Finding current journey options…</p>:feed.status==='error'?<p className="source-unavailable">{feed.error}</p>:feed.data?.coverageEligible===false?<p className="source-status">This planner does not cover both locations. Use the official national travel sources.</p>:feed.data?.journeys.length?<div className="journey-options"><p className="category-coverage">Destination: {request.to.label||postcode.toUpperCase()}. Check all route notices before travelling.</p>{feed.data.journeys.map((journey,index)=><article key={journey.id}><h4>Option {index+1} · {journey.duration} min</h4><p>{clock(journey.start)} → {clock(journey.arrival)} Europe/London{feed.stale?' · previous result':''}</p>{Date.parse(journey.start)<now&&<p className="source-unavailable">This suggested departure time has passed. Replan before travelling.</p>}<ol>{journey.legs.map((leg,index)=><li key={index}><strong>{leg.summary}</strong><p>{leg.mode} · {leg.duration} min</p>{leg.disrupted&&<p className="source-unavailable">Disruption reported on this leg.</p>}{leg.notices.map((notice,i)=><p className="source-unavailable" key={i}>{notice}</p>)}</li>)}</ol></article>)}</div>:<p className="source-status">No journey options were returned. This does not mean no transport is available.</p>}</div></>}
 </>}
 <a href="https://tfl.gov.uk/plan-a-journey/" target="_blank" rel="noreferrer">Check the official TfL journey planner</a></details>;
}
