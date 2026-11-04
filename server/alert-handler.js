import { getFeed } from './feeds.js';
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...headers,...extra}})}

// Shared by the Node server, Vite, and Cloudflare's Fetch runtime.
export async function handleAlertRequest(request, fetcher=fetch){
 let url;
 try{url=new URL(request.url)}catch{return json({error:'Invalid URL'},400)}
 if(url.pathname!=='/api'&&!url.pathname.startsWith('/api/'))return null;
 if(request.method!=='GET')return json({error:'GET required'},405,{Allow:'GET'});
 const prefix='/api/alerts/';
 const type=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):'';
 if(!['weather','traffic','safety','transport'].includes(type))return json({error:'Unknown alert category'},404);
 const rawLat=url.searchParams.get('lat'),rawLon=url.searchParams.get('lon');
 const lat=Number(rawLat),lon=Number(rawLon),radius=Number(url.searchParams.get('radius'));
 if(!rawLat?.trim()||!rawLon?.trim()||![lat,lon,radius].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||![10,25,50].includes(radius)){
  return json({error:'Valid coordinates and radius (10, 25, or 50 km) are required.'},400);
 }
 try{return json(await getFeed(type,{lat,lon},radius,fetcher))}
 catch{return json({error:'This official service is unavailable. Use the source link or try again later.'},502)}
}
