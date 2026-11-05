import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapPin, LocateFixed, AlertTriangle, ArrowUpRight, Droplets, RefreshCw } from 'lucide-react';
import { lookupPostcode, loadFloods, officialLink } from './api';
import AreaMap from './AreaMap';
import Forecast from './Forecast';
import FuelPrices from './FuelPrices';
import OtherAlerts from './OtherAlerts';
import EnvironmentAdvisories from './EnvironmentAdvisories';
import { loadForecast } from './api';
import {LiveFeedContext,useLiveFeed,LiveControls,FeedFreshness} from './LiveFeeds';
import {useLondonDay} from './useLondonDay';
import './style.css';

function LocationForm({busy, onSearch, onLocate}) {
  const [postcode,setPostcode]=useState('');
  const [radius,setRadius]=useState('25');
  return <section className="panel location"><h2>Choose a location</h2>
    <button className="primary locate" disabled={busy} onClick={()=>onLocate(radius)}><LocateFixed size={21}/>Use my location</button>
    <p className="privacy">Your location is used only for this search.</p>
    <div className="divider"><span>OR</span></div>
    <form onSubmit={e=>{e.preventDefault();onSearch(postcode,radius)}}>
      <label htmlFor="postcode">UK postcode</label><input id="postcode" autoComplete="postal-code" placeholder="e.g. SW1A 1AA" value={postcode} onChange={e=>setPostcode(e.target.value)} required maxLength={10}/>
      <label htmlFor="radius">Radius</label><select id="radius" value={radius} onChange={e=>setRadius(e.target.value)}><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select>
      <button className="primary" disabled={busy} type="submit">{busy?'Finding alerts…':'Search'}</button>
    </form></section>;
}
function Results({status, error, alerts, location, updated, onRefresh,feed}) {
  const gpsCoverage=Boolean(location&&!location.country);
  return <section className="panel results" aria-busy={status==='loading'}><div className="result-heading"><h2>Nearby flood alerts</h2>{location&&status!=='loading'&&<button className="refresh" onClick={onRefresh} aria-label="Refresh alerts" disabled={feed?.refreshing}><RefreshCw size={18}/></button>}</div>
    <FeedFreshness feed={feed}/><div role="status" aria-live="polite">{status==='idle'?<div className="notice"><AlertTriangle/><div><strong>Choose a location to see nearby alerts.</strong><p>Use your location or enter a UK postcode and radius, then search to see alerts in your area.</p></div></div>:status==='loading'?<p className="loading">Checking official flood alerts…</p>:status==='error'?<div className="notice error" role="alert"><AlertTriangle/><div><strong>We couldn’t complete your search.</strong><p>{error}</p></div></div>:<><p className="result-meta">{gpsCoverage?`${alerts.length} Environment Agency ${alerts.length===1?'alert':'alerts'} matched this England-only search.`:<>{alerts.length} active {alerts.length===1?'alert':'alerts'} near {location.label}</>}</p>{alerts.length===0?<div className="empty"><Droplets/><div><strong>{feed?.stale?'No active alerts were found at the previous check.':gpsCoverage?'No Environment Agency alerts matched this England-only search.':'No active alerts found in this search.'}</strong><p>This does not guarantee that your area is safe from flooding. Check official guidance before travelling.</p></div></div>:<div className="alert-list">{alerts.map((alert,i)=><article className={`flood severity-${alert.severityLevel}`} key={alert['@id']||i}><div className="severity"><AlertTriangle size={17}/>{alert.severity||'Flood alert'}</div><h3>{alert.description||alert.floodArea?.label||'Flooding in your area'}</h3>{alert.message&&<p>{alert.message}</p>}{alert.timeMessageChanged&&<small>Updated {new Date(alert.timeMessageChanged).toLocaleString('en-GB')}</small>}<a href={officialLink(alert)} target="_blank" rel="noreferrer">View official advice <ArrowUpRight size={16}/></a></article>)}</div>}<small className="checked">Environment Agency</small>{gpsCoverage&&<p className="category-coverage">GPS country coverage is estimated from a nearby postcode. Enter a postcode to confirm coverage near country borders.</p>}</>}</div></section>;
}
function Dashboard({enabled,onToggle,onRefresh}){
  const [selection,setSelection]=useState({status:'idle',location:null,radius:25,error:null});
  const request=useRef(0);
  const {location,radius}=selection;
  const today=useLondonDay();
  const flood=useLiveFeed({feedKey:location?`flood:${location.lat}:${location.lon}:${radius}`:null,load:signal=>loadFloods(location,radius,signal),interval:120000});
  const forecast=useLiveFeed({feedKey:location?`forecast:${location.lat}:${location.lon}`:null,load:signal=>loadForecast(location,signal),interval:600000,retainFor:1800000});
  const state={...selection,status:selection.status==='error'? 'error':location?(flood.status==='idle'?'loading':flood.status):selection.status,error:selection.error||flood.error,alerts:flood.data||[],updated:flood.updated?new Date(flood.updated):null};
  const weather={status:forecast.status,days:forecast.data||[]};
  const previousDay=useRef(today),refreshForecast=useRef(forecast.refresh);refreshForecast.current=forecast.refresh;
  useEffect(()=>{if(previousDay.current!==today&&enabled&&location)refreshForecast.current();previousDay.current=today},[today,enabled,location]);
  async function search(getLocation,radius){
    const id=++request.current;
    setSelection({status:'loading',location:null,radius,error:null});
    try{const location=await getLocation();if(id===request.current)setSelection({status:'success',location,radius,error:null});}
    catch(error){if(id===request.current)setSelection({status:'error',location:null,radius,error:error.message});}
  }
  function locate(radius){search(()=>new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Location is unavailable in this browser. Please enter your postcode.'));
    navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,label:'your current location'}),e=>reject(new Error(e.code===1?'Location permission was denied. You can enter your postcode instead.':'We couldn’t find your location. Please enter your postcode instead.')),{timeout:12000,maximumAge:60000});
  }),radius)}
  return <div className="shell"><header><a className="brand" href="./"><MapPin size={34}/><span>Neighbour</span></a><a href="#about">About alerts</a></header>
    <main><div className="intro"><h1>Know what’s happening near you.</h1><p>Find flood alerts, weather warnings, traffic updates and safety information near you.</p><p className="coverage">Floods: England · Weather: UK feed · Traffic: London live feed · Safety: official links</p></div>
      <LiveControls enabled={enabled} onToggle={onToggle} onRefresh={onRefresh} hasLocation={Boolean(location)}/>
      <div className="workspace">
        <div className="left-column">
          <LocationForm busy={state.status==='loading'} onLocate={locate} onSearch={(p,r)=>search(()=>lookupPostcode(p),r)}/>
          <Results {...state} feed={flood} onRefresh={flood.refresh}/>
          <OtherAlerts location={state.location} radius={state.radius}/><FuelPrices location={state.location} radius={state.radius}/>
        </div>
        <div className="area-column">
          <AreaMap location={state.location} radius={state.radius} alerts={state.alerts} floodStatus={state.status} stale={flood.stale}/>
          <Forecast {...weather} feed={forecast} today={today} location={location} onRefresh={forecast.refresh}/>
          <EnvironmentAdvisories location={state.location} days={weather.days} status={weather.status} forecastFeed={forecast} today={today}/>
        </div>
      </div>
      <section id="about" className="about"><h2>Official sources. Local information.</h2><p>Flood warnings and alerts are supplied by the Environment Agency under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">Open Government Licence</a>. Feeds refresh automatically while this page is visible and online, with manual pause and refresh controls. This site does not send background notifications. Searches use the flood service’s location-radius matching, not your property’s individual flood risk.</p><p>Your searches go to our server, which requests data directly from the Environment Agency, Open-Meteo, Postcodes.io, TfL and data.police.uk as needed. Your coordinates and postcode are sent only to the providers needed for that search. GPS flood coverage uses country information from a nearby postcode; enter a postcode to confirm coverage near country borders. Map tiles come from OpenStreetMap, which receives your IP address and the map area viewed. We don’t store your location.</p><div className="nation-links"><a href="https://check-for-flooding.service.gov.uk/" target="_blank" rel="noreferrer">England <ArrowUpRight size={14}/></a><a href="https://floodline.sepa.org.uk/floodupdates/" target="_blank" rel="noreferrer">Scotland <ArrowUpRight size={14}/></a><a href="https://flood-warning.naturalresources.wales/" target="_blank" rel="noreferrer">Wales <ArrowUpRight size={14}/></a><a href="https://www.nidirect.gov.uk/articles/check-risk-flooding-your-area" target="_blank" rel="noreferrer">Northern Ireland <ArrowUpRight size={14}/></a></div><p className="emergency">If there is immediate danger to life, call 999.</p></section>
    </main><footer>Neighbour <span>Stay aware. Stay prepared.</span></footer></div>
}
function App(){const [enabled,setEnabled]=useState(true),[revision,setRevision]=useState(0);return <LiveFeedContext.Provider value={{enabled,revision}}><Dashboard enabled={enabled} onToggle={setEnabled} onRefresh={()=>setRevision(v=>v+1)}/></LiveFeedContext.Provider>;}
createRoot(document.getElementById('root')).render(<App/>);
