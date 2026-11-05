import React from 'react';
import {calendarDay,upcomingForecast} from './calendar';
import {FeedFreshness} from './LiveFeeds';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, Droplets, RefreshCw } from 'lucide-react';
const conditions = code => {
 if(code===0)return ['Clear sky',Sun];
 if([1,2].includes(code))return ['Partly cloudy',CloudSun];
 if(code===3)return ['Overcast',Cloud];
 if([45,48].includes(code))return ['Fog',CloudFog];
 if([71,73,75,77,85,86].includes(code))return ['Snow',CloudSnow];
 if([95,96,99].includes(code))return ['Thunderstorms',CloudLightning];
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return ['Rain',CloudRain];
 return ['Conditions unavailable',Cloud];
};
const temperature=value=>Number.isFinite(value)?`${Math.round(value)}°`:'—';
export default function Forecast({status,days,location,onRefresh,feed,today=calendarDay()}) {
 const visibleDays=upcomingForecast(days,today);
 return <section className="panel forecast" aria-busy={status==='loading'}><div className="result-heading"><h2>Local weather forecast</h2>{location && status!=='loading'&&<button className="refresh" onClick={onRefresh} aria-label="Refresh forecast" disabled={feed?.refreshing}><RefreshCw size={18}/></button>}</div>
 <FeedFreshness feed={feed}/><div aria-live="polite">{!location?<p className="forecast-note">Choose a location to see the next seven days.</p>:['idle','loading'].includes(status)?<p className="forecast-note">Loading the forecast for {location.label}…</p>:status==='error'?<p className="weather-error" role="alert">Weather forecast unavailable. Try refreshing the forecast. Flood alerts are checked separately.</p>:<><p className="forecast-note">Next seven days · {location.label}</p>{!visibleDays.some(day=>day.date===today)&&<p className="weather-error">Today’s forecast is unavailable. Refresh for current dates.</p>}<div className="forecast-days" role="list" tabIndex={0} aria-label="Seven-day forecast; scroll horizontally for more days">{visibleDays.map((day)=>{const [label,Icon]=conditions(day.code);return <article className="forecast-day" role="listitem" key={day.date}><h3>{day.date===today?'Today':new Date(day.date+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'Europe/London',weekday:'short'})}</h3><time dateTime={day.date}>{new Date(day.date+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short'})}</time><Icon aria-label={label} role="img" size={28}/><span className="condition">{label}</span><p className="temperatures"><strong aria-label={`High ${temperature(day.high)} Celsius`}>{temperature(day.high)}</strong><span aria-label={`Low ${temperature(day.low)} Celsius`}>{temperature(day.low)}</span></p><span className="rain"><Droplets size={13}/>{Number.isFinite(day.rain)?`${day.rain}%`:'—'}</span></article>})}</div><p className="forecast-source">°C · High / low · Rain: maximum daily probability<br/>Forecast: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Europe/London · Not a flood prediction</p></>}</div></section>;
}
