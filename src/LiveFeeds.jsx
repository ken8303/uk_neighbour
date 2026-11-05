import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
export const LiveFeedContext=createContext({enabled:true,revision:0});
const empty=()=>({key:null,status:'idle',data:null,updated:null,error:null,refreshing:false,stale:false});
export function useLiveFeed({feedKey,load,interval=60000,retainFor=300000,revision=0}){
 const settings=useContext(LiveFeedContext),[state,setState]=useState(empty),[manual,setManual]=useState(0);
 const loader=useRef(load),enabled=useRef(settings.enabled),runner=useRef(null),stopTimer=useRef(null);
 loader.current=load;enabled.current=settings.enabled;
 useEffect(()=>{
  if(!feedKey){setState(empty());return;}
  let disposed=false,running=false,timer,controller,failures=0;
  const available=()=>navigator.onLine!==false&&document.visibilityState!=='hidden';
  const clear=()=>{clearTimeout(timer)};stopTimer.current=clear;
  function retain(previous){const source=Date.parse(previous.data?.freshness?.verifiedAt);const ageFrom=Number.isFinite(source)?Math.min(previous.updated,source):previous.updated;return previous.key===feedKey&&previous.data!==null&&Date.now()-ageFrom<=retainFor;}
  async function run(force=false){
   clear();if(disposed||running)return;
   if(!force&&!available())return;
   if(navigator.onLine===false){setState(s=>({...((retain(s))?s:empty()),key:feedKey,status:retain(s)?'success':'error',data:retain(s)?s.data:null,stale:retain(s),error:'You are offline. Reconnect to refresh.',refreshing:false}));return;}
   running=true;controller=new AbortController();
   setState(s=>retain(s)?{...s,refreshing:true,error:null}:{...empty(),key:feedKey,status:'loading',refreshing:true});
   try{
    const data=await loader.current(controller.signal);
    if(!disposed){failures=0;setState({key:feedKey,status:'success',data,updated:Date.now(),error:null,refreshing:false,stale:data?.freshness?.state==='stale'});}
   }catch(error){
    if(!disposed){failures++;setState(s=>({...((retain(s))?s:empty()),key:feedKey,status:retain(s)?'success':'error',data:retain(s)?s.data:null,stale:retain(s),error:navigator.onLine===false?'You are offline. Reconnect to refresh.':error.message||'Refresh failed.',refreshing:false}));}
   }finally{
    running=false;if(!disposed&&enabled.current&&available())timer=setTimeout(()=>run(),Math.min(interval*2**Math.min(failures,2),Math.max(interval,300000)));
   }
  }
  runner.current=run;
  const resume=()=>{if(enabled.current&&available())void run();};
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
  if(available())void run();else if(navigator.onLine===false)void run(true);
  return()=>{disposed=true;clear();controller?.abort();document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);runner.current=null;};
 },[feedKey,interval,retainFor,manual,revision,settings.revision]);
 const previouslyEnabled=useRef(settings.enabled);
 useEffect(()=>{
  if(!settings.enabled)stopTimer.current?.();
  else if(!previouslyEnabled.current)void runner.current?.();
  previouslyEnabled.current=settings.enabled;
 },[settings.enabled]);
 useEffect(()=>{
  if(state.key!==feedKey||state.data===null)return;
  const verified=Date.parse(state.data?.freshness?.verifiedAt);
  const since=Number.isFinite(verified)?Math.min(verified,state.updated):state.updated;
  const timer=setTimeout(()=>setState(s=>s.key===feedKey&&s.updated===state.updated?{...empty(),key:feedKey,status:'error',error:'Previous data expired. Refresh to check the current status.'}:s),Math.max(0,since+retainFor-Date.now()));
  return()=>clearTimeout(timer);
 },[state.key,state.data,state.updated,feedKey,retainFor]);
 const visible=state.key===feedKey?state:empty();
 return {...visible,refresh:()=>setManual(v=>v+1)};
}
export function FeedFreshness({feed}){
 const settings=useContext(LiveFeedContext);
 if(!feed)return null;
 const meta=feed.data?.freshness;
 const stamp=meta?.verifiedAt||(feed.updated?new Date(feed.updated).toISOString():null);
 const valid=stamp&&Number.isFinite(Date.parse(stamp));
 return <div className="feed-freshness" aria-live="polite">{feed.refreshing&&<p>Updating…</p>}{feed.stale&&<p className="source-unavailable">Showing a previous result — the latest refresh failed. It may be out of date.</p>}{valid&&<p className="source-checked">{meta?'Source verified':'Last successful check'} {new Date(stamp).toLocaleString('en-GB',{timeZone:'Europe/London'})} · Europe/London{meta?.cache==='hit'?` · cached up to ${(meta.cacheTtlSeconds||60)>=60?`${Math.round((meta.cacheTtlSeconds||60)/60)} minute${(meta.cacheTtlSeconds||60)>60?'s':''}`:`${meta.cacheTtlSeconds||60} seconds`}`:''}{meta?.cache==='revalidated'?' · unchanged at source':''}</p>}{meta?.sourceUpdatedAt&&<p className="source-checked">Provider update: {new Date(meta.sourceUpdatedAt).toLocaleString('en-GB',{timeZone:'Europe/London'})}</p>}{feed.error&&feed.status==='error'&&<p className="source-checked">{navigator.onLine===false?'Offline — reconnect to refresh.':(settings.enabled?'Refresh failed. Automatic checks will retry while this page is visible.':'Refresh failed. Use refresh to retry.')}</p>}</div>;
}
export function LiveControls({enabled,onToggle,onRefresh,hasLocation}){
 const [online,setOnline]=useState(navigator.onLine!==false);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine!==false);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[]);
 return <div className="live-controls"><label><input type="checkbox" checked={enabled} onChange={e=>onToggle(e.target.checked)}/>Auto-refresh</label><span>{!online?'Offline — waiting for a connection':enabled?'Alerts every 1–2 min · forecasts every 10 min · pauses in hidden tabs':'Automatic refresh paused'}</span><button disabled={!hasLocation||!online} onClick={onRefresh}>Refresh all</button></div>;
}
