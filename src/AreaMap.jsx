import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { loadFloodPoints, officialLink } from './api';

export default function AreaMap({location,radius,alerts,floodStatus}) {
 const host=useRef(null), map=useRef(null), overlays=useRef(null);
 const [tileError,setTileError]=useState(false),[points,setPoints]=useState([]),[loading,setLoading]=useState(false);
 useEffect(()=>{
  setPoints([]);
  if(!location || floodStatus!=='success'){setLoading(false);return;}
  const controller=new AbortController();setLoading(true);
  loadFloodPoints(alerts,controller.signal).then(p=>{if(!controller.signal.aborted){setPoints(p);setLoading(false)}});
  return ()=>controller.abort();
 },[alerts,location,floodStatus]);
 useEffect(()=>{
  if(!location||!host.current)return;
  setTileError(false);
  const instance=L.map(host.current,{scrollWheelZoom:false}).setView([location.lat,location.lon],10);
  map.current=instance;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>setTileError(true)).addTo(instance);
  overlays.current=L.layerGroup().addTo(instance);
  const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(host.current);
  return ()=>{observer.disconnect();instance.remove();map.current=null;overlays.current=null};
 },[Boolean(location)]);
 useEffect(()=>{
  if(!map.current||!location)return;
  map.current.fitBounds(L.latLng(location.lat,location.lon).toBounds(Number(radius)*2000),{padding:[16,16],animate:false});
 },[location,radius]);
 useEffect(()=>{
  if(!overlays.current||!location)return;
  overlays.current.clearLayers();
  L.circle([location.lat,location.lon],{radius:Number(radius)*1000,color:'#086759',weight:2,fillOpacity:.05,dashArray:'5 6',interactive:false}).addTo(overlays.current);
  L.circleMarker([location.lat,location.lon],{radius:7,color:'#fff',weight:3,fillColor:'#086759',fillOpacity:1}).bindTooltip('Selected location',{direction:'top'}).addTo(overlays.current);
  for(const point of points){
   const content=document.createElement('div');
   const title=document.createElement('strong');title.textContent=point.alert.description||'Flood area';content.append(title);
   const severity=document.createElement('p');severity.textContent=point.alert.severity||'Flood alert';content.append(severity);
   const link=document.createElement('a');link.href=officialLink(point.alert);link.textContent='View official advice';link.target='_blank';link.rel='noreferrer';content.append(link);
   L.circleMarker([point.lat,point.lon],{radius:9,color:'#fff',weight:2,fillColor:Number(point.alert.severityLevel)<3?'#bf4233':'#b7790d',fillOpacity:1}).bindPopup(content).addTo(overlays.current);
  }
 },[location,radius,points]);
 function reset(){if(map.current&&location)map.current.fitBounds(L.latLng(location.lat,location.lon).toBounds(Number(radius)*2000),{padding:[16,16],animate:false})}
 return <section className="panel map-panel"><div className="result-heading"><h2>Your area at a glance</h2>{location&&<button className="map-reset" onClick={reset}>Reset view</button>}</div>
 {location?<><p className="map-location">{location.label} · {radius} km search radius</p><div ref={host} className="live-map" role="region" aria-label="Interactive location and flood-area map"/>{tileError&&<p className="tile-error" role="status">Street map tiles unavailable. Location and radius overlays still work. <a href={`https://www.openstreetmap.org/#map=11/${location.lat}/${location.lon}`} target="_blank" rel="noreferrer">Open street map separately</a>.</p>}<div className="map-legend"><span><i className="dot selected"/>Selected location</span><span><i className="dot warning"/>Warning</span><span><i className="dot alert"/>Alert</span></div><p className="map-note">{loading?'Locating flood areas…':floodStatus==='success'?`${points.length} of ${alerts.length} alerts located on the map.`:floodStatus==='error'?'Flood alert data unavailable.':'Checking flood alerts…'} Flood-area markers are representative points, not flood boundaries. See the alert list for all results.</p></>:<div className="map-placeholder"><MapPin size={42}/><p>Choose a location to explore the map.</p><span>Your selected location, search radius and available flood-area points will appear here.</span></div>}
 </section>;
}
