export async function getJSON(url, signal) {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 404 ? 'Postcode not found. Check it and try again.' : 'The alert or location service is unavailable. Please try again shortly.');
  return response.json();
}
export async function lookupPostcode(postcode, signal) {
  const value = postcode.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(value)) throw new Error('Enter a valid UK postcode, such as SW1A 1AA.');
  const data = await getJSON(`https://api.postcodes.io/postcodes/${encodeURIComponent(value)}`, signal);
  if (!data.result) throw new Error('Postcode not found. Check it and try again.');
  return { lat: data.result.latitude, lon: data.result.longitude, label: data.result.postcode, country: data.result.country };
}
export async function loadFloods(location, radius, signal) {
  if(location.country && location.country!=='England') throw new Error('This flood feed covers England only. Weather, traffic coverage and safety sources are shown separately below.');
  const url = new URL('https://environment.data.gov.uk/flood-monitoring/id/floods');
  url.search = new URLSearchParams({ lat: location.lat, long: location.lon, dist: radius });
  const data = await getJSON(url, signal);
  if (!Array.isArray(data.items)) throw new Error('The flood service returned an unexpected response. Please try again.');
  return data.items.filter(item => [1, 2, 3].includes(Number(item.severityLevel))).sort((a,b) => Number(a.severityLevel)-Number(b.severityLevel));
}
export function officialLink(alert) {
  const code = alert.floodAreaID || alert.floodArea?.notation;
  return code && /^[a-z0-9_-]+$/i.test(code) ? `https://check-for-flooding.service.gov.uk/target-area/${encodeURIComponent(code)}` : 'https://check-for-flooding.service.gov.uk/';
}

export async function loadForecast(location, signal) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({latitude:location.lat, longitude:location.lon, daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone:'Europe/London', forecast_days:7});
  const data = await getJSON(url, signal);
  const d=data.daily;
  if (!Array.isArray(d?.time) || !d.time.length || !Array.isArray(d.temperature_2m_max) || !Array.isArray(d.temperature_2m_min)) throw new Error('The weather service returned an unexpected response.');
  return d.time.map((date,i)=>({date,code:d.weather_code?.[i],high:d.temperature_2m_max[i],low:d.temperature_2m_min[i],rain:d.precipitation_probability_max?.[i]}));
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
          const data=await getJSON(`https://environment.data.gov.uk/flood-monitoring/id/floodAreas/${encodeURIComponent(code)}`,signal);
          area=data.items;
        }
        if(Number.isFinite(area?.lat)&&Number.isFinite(area?.long)&&Math.abs(area.lat)<=90&&Math.abs(area.long)<=180) points.push({alert,lat:area.lat,lon:area.long});
      }catch { /* Missing geometry must not suppress the corresponding alert in the list. */ }
    }
  }));
  return points;
}
