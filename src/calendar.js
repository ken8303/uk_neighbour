const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'});
export function londonDate(now=Date.now()){
 const parts=Object.fromEntries(formatter.formatToParts(new Date(now)).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function calendarDay(reference=Date.now()){return typeof reference==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(reference)?reference:londonDate(reference)}
export function upcomingForecast(days,reference=Date.now()){
 const today=calendarDay(reference);
 return days.filter(day=>typeof day.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&Number.isFinite(Date.parse(day.date))&&new Date(day.date).toISOString().slice(0,10)===day.date&&day.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
}
// Searching by calendar date avoids assuming a 24-hour day across UK DST changes.
export function nextLondonMidnight(now=Date.now()){
 const today=londonDate(now);let lo=now,hi=now+26*3600000;
 while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(londonDate(mid)===today)lo=mid;else hi=mid;}
 return hi;
}
