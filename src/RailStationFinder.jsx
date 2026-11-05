import React,{useId,useState} from 'react';
import {useLiveFeed} from './LiveFeeds';
export default function RailStationFinder({location,radius}){
 const id=useId(),[open,setOpen]=useState(false),[text,setText]=useState(''),[search,setSearch]=useState(null),[error,setError]=useState(null);
 const key=search?`rail-search:${search.query}:${search.sequence}`:location?`rail-nearby:${location.lat}:${location.lon}:${radius}`:null;
 const feed=useLiveFeed({feedKey:open?key:null,interval:86400000,retainFor:86400000,load:async signal=>{
  const params=search?new URLSearchParams({search:search.query}):new URLSearchParams({lat:location.lat,lon:location.lon,radius});
  const response=await fetch(`/api/alerts/rail-stations?${params}`,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Station reference data unavailable');if(!Array.isArray(data.stations)||!data.dataset)throw new Error('Unexpected station reference data');return data;
 }});
 function submit(event){event.preventDefault();const query=text.trim();if(query.length<2||query.length>80){setError('Enter at least two letters or a three-letter CRS station code.');return;}setError(null);setSearch({query,sequence:Date.now()});}
 return <details className="nearby-departures rail-station-finder" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Find rail stations · England, Scotland & Wales</summary>
 <p className="category-coverage">Station reference data, not live departures. Search by name or CRS station code without a postcode, or find stations within your selected radius. Northern Ireland and some local networks are not included. A listed station is not confirmation that it is open or accessible.</p>
 <form onSubmit={submit}><label className="departure-label" htmlFor={`${id}-query`}>Station name or CRS code</label><input className="journey-postcode" id={`${id}-query`} value={text} onChange={event=>setText(event.target.value)} maxLength={80} placeholder="For example, Edinburgh or EDB"/><button className="departure-refresh" type="submit" disabled={feed.refreshing}>Search rail stations</button></form>
 {location&&<button className="departure-refresh rail-nearby-button" type="button" disabled={feed.refreshing} onClick={()=>{setError(null);setText('');setSearch(null);feed.refresh()}}>Find stations near my selected location</button>}
 {error&&<p className="source-unavailable" role="alert">{error}</p>}
 <div aria-live="polite">{!key?<p className="source-status">Enter a station name or code, or choose a location to find nearby stations.</p>:['idle','loading'].includes(feed.status)?<p className="source-status">Searching station reference data…</p>:feed.status==='error'?<p className="source-unavailable">{feed.error}</p>:<>
 {feed.stale&&<p className="source-unavailable">The latest lookup failed. Showing a previous reference result.</p>}
 <p className="category-coverage">{search?`Results for “${search.query}”`:`Stations within ${radius} km of your selected location`} · {feed.data.total} reference matches{feed.data.total>20?' · showing the first 20':''}. Distances are straight-line distances.</p>
 {feed.data.stations.length?<ul className="cycle-stations">{feed.data.stations.map(station=><li key={station.code}><h4>{station.name} · {station.code}</h4><p>{station.country[0].toUpperCase()+station.country.slice(1)}{Number.isFinite(station.distanceKm)?` · ${station.distanceKm.toFixed(1)} km away`:''}</p><a href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`} target="_blank" rel="noreferrer">Directions to {station.name}</a></li>)}</ul>:<p className="source-status">No reference stations matched this search. This does not mean there are no local transport services.</p>}
 <p className="category-coverage">Reference snapshot: {new Date(`${feed.data.dataset.sourceUpdated}T12:00:00Z`).toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'long',year:'numeric'})}. This date is not a live-service check.</p>
 </>}</div>
 <p className="category-coverage">Data: <a href="https://github.com/davwheat/uk-railway-stations" target="_blank" rel="noreferrer">David Wheatley</a>, <a href="https://github.com/trainline-eu/stations" target="_blank" rel="noreferrer">Trainline EU and source contributors</a> · <a href="/data/gb-rail-stations-LICENSE.txt" target="_blank" rel="noreferrer">ODbL 1.0</a> · <a href="/data/gb-rail-stations.json" download>Download reference data</a> · <a href="/data/gb-rail-stations-SOURCE.md" target="_blank" rel="noreferrer">Full attribution</a>.</p>
 <a href="https://www.nationalrail.co.uk/" target="_blank" rel="noreferrer">Check National Rail for current departures and station information</a>
 </details>;
}
