import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapPin, LocateFixed, AlertTriangle, ArrowUpRight, Droplets, RefreshCw } from 'lucide-react';
import { lookupPostcode, loadFloods, officialLink } from './api';
import AreaMap from './AreaMap';
import Forecast from './Forecast';
import OtherAlerts from './OtherAlerts';
import EnvironmentAdvisories from './EnvironmentAdvisories';
import { loadForecast } from './api';
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
function Results({status, error, alerts, location, updated, onRefresh}) {
  return <section className="panel results" aria-busy={status==='loading'}><div className="result-heading"><h2>Nearby flood alerts</h2>{status==='success'&&<button className="refresh" onClick={onRefresh} aria-label="Refresh alerts"><RefreshCw size={18}/></button>}</div>
    <div role="status" aria-live="polite">{status==='idle'?<div className="notice"><AlertTriangle/><div><strong>Choose a location to see nearby alerts.</strong><p>Use your location or enter a UK postcode and radius, then search to see alerts in your area.</p></div></div>:status==='loading'?<p className="loading">Checking official flood alerts…</p>:status==='error'?<div className="notice error" role="alert"><AlertTriangle/><div><strong>We couldn’t complete your search.</strong><p>{error}</p></div></div>:<><p className="result-meta">{alerts.length} active {alerts.length===1?'alert':'alerts'} near {location.label}</p>{alerts.length===0?<div className="empty"><Droplets/><div><strong>No active alerts found in this search.</strong><p>This does not guarantee that your area is safe from flooding. Check official guidance before travelling.</p></div></div>:<div className="alert-list">{alerts.map((alert,i)=><article className={`flood severity-${alert.severityLevel}`} key={alert['@id']||i}><div className="severity"><AlertTriangle size={17}/>{alert.severity||'Flood alert'}</div><h3>{alert.description||alert.floodArea?.label||'Flooding in your area'}</h3>{alert.message&&<p>{alert.message}</p>}{alert.timeMessageChanged&&<small>Updated {new Date(alert.timeMessageChanged).toLocaleString('en-GB')}</small>}<a href={officialLink(alert)} target="_blank" rel="noreferrer">View official advice <ArrowUpRight size={16}/></a></article>)}</div>}<small className="checked">Checked {updated?.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · Environment Agency</small></>}</div></section>;
}
function App(){
  const [state,setState]=useState({status:'idle',alerts:[],location:null,radius:25});
  const request=useRef(0);
  const weatherRequest=useRef(0);
  const [weather,setWeather]=useState({status:'idle',days:[]});
  async function refreshWeather(location){
    const id=++weatherRequest.current;
    setWeather({status:'loading',days:[]});
    try{const days=await loadForecast(location);if(id===weatherRequest.current)setWeather({status:'success',days});}
    catch{if(id===weatherRequest.current)setWeather({status:'error',days:[]});}
  }
  async function search(getLocation,radius){
    const id=++request.current;
    weatherRequest.current++;
    setWeather({status:'idle',days:[]});
    setState(s=>({...s,status:'loading',location:null,alerts:[],error:null}));
    try{
      const location=await getLocation();
      if(id!==request.current)return;
      setState(s=>({...s,location,radius,alerts:[]}));
      void refreshWeather(location);
      const alerts=await loadFloods(location,radius);
      if(id===request.current)setState({status:'success',location,radius,alerts,updated:new Date()});
    }catch(e){if(id===request.current)setState(s=>({...s,status:'error',error:e.message}));}
  }
  function locate(radius){search(()=>new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Location is unavailable in this browser. Please enter your postcode.'));
    navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,label:'your current location'}),e=>reject(new Error(e.code===1?'Location permission was denied. You can enter your postcode instead.':'We couldn’t find your location. Please enter your postcode instead.')),{timeout:12000,maximumAge:60000});
  }),radius)}
  return <div className="shell"><header><a className="brand" href="./"><MapPin size={34}/><span>Neighbour</span></a><a href="#about">About alerts</a></header>
    <main><div className="intro"><h1>Know what’s happening near you.</h1><p>Find flood alerts, weather warnings, traffic updates and safety information near you.</p><p className="coverage">Floods: England · Weather: UK feed · Traffic: London live feed · Safety: official links</p></div>
      <div className="workspace">
        <div className="left-column">
          <LocationForm busy={state.status==='loading'} onLocate={locate} onSearch={(p,r)=>search(()=>lookupPostcode(p),r)}/>
          <Results {...state} onRefresh={()=>search(()=>Promise.resolve(state.location),state.radius)}/>
          <OtherAlerts location={state.location} radius={state.radius}/>
        </div>
        <div className="area-column">
          <AreaMap location={state.location} radius={state.radius} alerts={state.alerts} floodStatus={state.status}/>
          <Forecast {...weather} location={state.location} onRefresh={()=>refreshWeather(state.location)}/>
          <EnvironmentAdvisories location={state.location} days={weather.days} status={weather.status}/>
        </div>
      </div>
      <section id="about" className="about"><h2>Official sources. Local information.</h2><p>Flood warnings and alerts are supplied by the Environment Agency under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">Open Government Licence</a>. Results are checked when you search or refresh; this site does not send background notifications. Searches use the flood service’s location-radius matching, not your property’s individual flood risk.</p><p>Your coordinates are sent to the Environment Agency and Open-Meteo for alerts, weather and air-quality forecasts, and to our server for matching weather and traffic reports and finding your police neighbourhood. The police lookup sends coordinates to data.police.uk; Met Office and TfL feeds are filtered on our server. Postcodes are sent to Postcodes.io. Map tiles come from OpenStreetMap, which receives your IP address and the map area viewed. We don’t store your location.</p><div className="nation-links"><a href="https://check-for-flooding.service.gov.uk/" target="_blank" rel="noreferrer">England <ArrowUpRight size={14}/></a><a href="https://floodline.sepa.org.uk/floodupdates/" target="_blank" rel="noreferrer">Scotland <ArrowUpRight size={14}/></a><a href="https://flood-warning.naturalresources.wales/" target="_blank" rel="noreferrer">Wales <ArrowUpRight size={14}/></a><a href="https://www.nidirect.gov.uk/articles/check-risk-flooding-your-area" target="_blank" rel="noreferrer">Northern Ireland <ArrowUpRight size={14}/></a></div><p className="emergency">If there is immediate danger to life, call 999.</p></section>
    </main><footer>Neighbour <span>Stay aware. Stay prepared.</span></footer></div>
}
createRoot(document.getElementById('root')).render(<App/>);
