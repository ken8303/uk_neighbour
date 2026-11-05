export async function getJSON(url, signal) {
  const response = await fetch(url, { cache:'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 404 ? 'Postcode not found. Check it and try again.' : 'The alert or location service is unavailable. Please try again shortly.');
  return response.json();
}
function query(location,radius=25){return new URLSearchParams({lat:location.lat,lon:location.lon,radius})}
function withFreshness(items,data){items.freshness=data.freshness;return items;}
export async function lookupPostcode(postcode,signal){
 const clean=postcode.replace(/\s/g,'').toUpperCase();
 if(!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(clean))throw new Error('Enter a valid UK postcode, such as SW1A 1AA.');
 const data=await getJSON(`/api/alerts/postcode?${new URLSearchParams({postcode:clean})}`,signal);
 if(!data.location||!Number.isFinite(data.location.lat)||!Number.isFinite(data.location.lon))throw new Error('Postcode lookup returned invalid coordinates.');
 return data.location;
}
export async function loadFloods(location,radius,signal){
 let country=location.country;
 if(!country){
  try{const coverage=await getJSON(`/api/alerts/location?${query(location)}`,signal);country=coverage.location?.country;}
  catch(error){if(signal?.aborted)throw error;throw new Error('Flood coverage could not be confirmed. Enter a postcode to check coverage.');}
 }
 if(!country)throw new Error('Flood coverage could not be confirmed. Enter a postcode to check coverage.');
 if(country!=='England')throw new Error('This flood feed covers England only. Weather, traffic coverage and safety sources are shown separately below.');
 const data=await getJSON(`/api/alerts/floods?${query(location,radius)}`,signal);
 if(!Array.isArray(data.items))throw new Error('The flood service returned an unexpected response. Please try again.');
 return withFreshness(data.items,data);
}
export function officialLink(alert) {
  const code = alert.floodAreaID || alert.floodArea?.notation;
  return code && /^[a-z0-9_-]+$/i.test(code) ? `https://check-for-flooding.service.gov.uk/target-area/${encodeURIComponent(code)}` : 'https://check-for-flooding.service.gov.uk/';
}

export async function loadForecast(location,signal){
 const data=await getJSON(`/api/alerts/forecast?${query(location)}`,signal);
 if(!Array.isArray(data.days)||!data.days.length)throw new Error('The weather service returned an unexpected response.');
 return withFreshness(data.days,data);
}

// Flood areas are represented by the EA's published reference points, not boundaries.
export async function loadFloodPoints(alerts, signal) {
  const unique = [...new Map(alerts.map(a=>[a.floodAreaID || a.floodArea?.notation,a])).values()];
  const points=[];
  let next=0;
  await Promise.all(Array.from({length:Math.min(4,unique.length)},async()=>{
    while(next<unique.length && !signal?.aborted){
      const alert=unique[next++];
      const code=alert.floodAreaID || alert.floodArea?.notation;
      if(!code || !/^[a-z0-9_-]+$/i.test(code)) continue;
      try {
        let area=alert.floodArea;
        if(!Number.isFinite(area?.lat)||!Number.isFinite(area?.long)) {
          const data=await getJSON(`/api/alerts/flood-area?${new URLSearchParams({lat:0,lon:0,radius:25,code})}`,signal);
          area=data.items;
        }
        if(Number.isFinite(area?.lat)&&Number.isFinite(area?.long)&&Math.abs(area.lat)<=90&&Math.abs(area.long)<=180) points.push({alert,lat:area.lat,lon:area.long});
      }catch { /* Missing geometry must not suppress the corresponding alert in the list. */ }
    }
  }));
  return points;
}

export async function loadAirQuality(location,signal){
 const data=await getJSON(`/api/alerts/air?${query(location)}`,signal);
 if(!Number.isFinite(data.current?.time)||!Number.isFinite(data.current?.european_aqi)||data.current.european_aqi<0)throw new Error('Air-quality data unavailable');
 return {current:data.current,hourly:data.hourly||{},freshness:data.freshness};
}
