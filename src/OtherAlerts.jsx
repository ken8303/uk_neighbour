import React, { useEffect, useState } from 'react';
import { CloudLightning, TrafficCone, ShieldCheck, ArrowUpRight, RefreshCw } from 'lucide-react';

const categories=[
 {id:'weather',title:'Severe weather warnings',Icon:CloudLightning,source:'Met Office',url:'https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings',coverage:'UK warning feed. Where the source has no area geometry, warnings are labelled UK-wide feed entries and are not confirmed near you.'},
 {id:'traffic',title:'Traffic & road closures',Icon:TrafficCone,source:'TfL traffic status',url:'https://tfl.gov.uk/traffic/status/',coverage:'Live integration covers TfL London roads only, using the reported disruption point. It does not include every local road or closure.'},
 {id:'safety',title:'Local safety & emergencies',Icon:ShieldCheck,source:'UK emergency alerts',url:'https://www.gov.uk/alerts',coverage:'Official guidance and local police links. No live local incident feed is connected; absence of reports here is not an all-clear.'},
];
const initial=()=>Object.fromEntries(categories.map(c=>[c.id,{status:'idle'}]));
function SourceLink({href,children}){return <a href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={14}/></a>}
function Checked({time}){return time&&<p className="source-checked">Checked {new Date(time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</p>}
function Category({category,data,location,onRefresh}){
 const {id,title,Icon,source,url,coverage}=category;
 return <section className="other-category" aria-labelledby={`category-${id}`} aria-busy={data.status==='loading'}>
 <div className="category-heading"><h3 id={`category-${id}`}><Icon size={19}/>{title}</h3>{location&&data.status!=='loading'&&<button className="refresh" aria-label={`Refresh ${title.toLowerCase()}`} onClick={onRefresh}><RefreshCw size={16}/></button>}</div>
 <p className="category-coverage">{coverage}</p>
 <div aria-live="polite">{!location?<p className="source-status">Choose a location to check this service.</p>:data.status==='loading'?<p className="source-status">Checking {id==='safety'?'your police neighbourhood':'the official feed'}…</p>:data.status==='error'?<p className="source-unavailable">{id==='safety'?'Police neighbourhood lookup unavailable. Use the official links below.':'Live feed unavailable. Check the official source for current information.'}</p>:id==='safety'?<div className="safety-links">{data.neighbourhood?<><p className="source-status">Your police neighbourhood: <strong>{data.neighbourhood.name}</strong></p><SourceLink href={data.neighbourhood.link}>Local police information</SourceLink></>:<p className="source-status">No police neighbourhood was returned for this location.</p>}</div>:<>{data.items?.length?<div className="other-alert-list">{data.items.map((item,index)=><article className="other-alert" key={item.id||index}><span className={`other-severity tone-${item.severity?.toLowerCase()}`}>{item.severity}</span><h4>{item.title}</h4><p className="alert-scope">{item.scope}</p>{item.description&&<p className="other-description">{item.description}</p>}<SourceLink href={item.link}>View {id==='weather'?'warning and affected areas':'traffic details'}</SourceLink></article>)}</div>:<p className="source-status">{id==='weather'?'No warning entries matched this search in the current feed.':'No current TfL disruptions with a reported point matched this radius. Roads outside TfL coverage are not assessed.'}</p>}{id==='weather'&&<p className="validity-note">Check the source for exact affected areas and start/end times. A published warning may start later.</p>}</>}</div>
 <Checked time={data.checkedAt}/>
 <div className="official-links"><SourceLink href={url}>{source}</SourceLink>{id==='traffic'&&<><SourceLink href="https://www.trafficengland.com/">England major roads</SourceLink><SourceLink href="https://www.traffic.gov.scot/">Traffic Scotland</SourceLink><SourceLink href="https://traffic.wales/">Traffic Wales</SourceLink><SourceLink href="https://www.trafficwatchni.com/">Trafficwatch NI</SourceLink></>}{id==='safety'&&<><SourceLink href="https://www.police.uk/pu/your-area/">Find your local police</SourceLink><SourceLink href="https://www.gov.uk/find-local-council">Local council updates</SourceLink></>}</div>
 </section>;
}
export default function OtherAlerts({location,radius}){
 const [filter,setFilter]=useState('all'),[sources,setSources]=useState(initial),[version,setVersion]=useState({weather:0,traffic:0,safety:0});
 // Each source owns its request, cancellation, and failure state.
 return <section className="panel other-alerts"><div className="other-header"><h2>More local alerts</h2><label htmlFor="alert-type" className="sr-only">Filter other alert types</label><select id="alert-type" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All types</option><option value="weather">Weather</option><option value="traffic">Traffic</option><option value="safety">Safety</option></select></div>
 {categories.map(category=><SourceRequest key={category.id} category={category} location={location} radius={radius} version={version[category.id]} onData={value=>setSources(s=>({...s,[category.id]:value}))}/>)}
 {categories.filter(c=>filter==='all'||c.id===filter).map(category=><Category key={category.id} category={category} data={sources[category.id]} location={location} onRefresh={()=>setVersion(v=>({...v,[category.id]:v[category.id]+1}))}/>)}
 <p className="other-footer">Each service has different coverage. The map above shows flood-area points only.</p></section>;
}
function SourceRequest({category,location,radius,version,onData}){
 // Keep the setter callback stable without making it an effect dependency.
 const callback=React.useRef(onData);callback.current=onData;
 useEffect(()=>{
  if(!location){callback.current({status:'idle'});return;}
  const controller=new AbortController();callback.current({status:'loading'});
  const query=new URLSearchParams({lat:location.lat,lon:location.lon,radius});
  fetch(`/api/alerts/${category.id}?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}).then(async response=>{
   if(!response.ok)throw new Error('Unavailable');
   const data=await response.json();
   if(category.id!=='safety'&&!Array.isArray(data.items))throw new Error('Unexpected feed');
   if(!controller.signal.aborted)callback.current({...data,status:'success'});
  }).catch(()=>{if(!controller.signal.aborted)callback.current({status:'error'})});
  return ()=>controller.abort();
 },[category.id,location,radius,version]);
 return null;
}
