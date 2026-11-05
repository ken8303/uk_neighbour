const london=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const partsOf=time=>Object.fromEntries(london.formatToParts(new Date(time)).map(p=>[p.type,p.value]));
export function parseLondonTime(value){
 if(typeof value!=='string'||!value.trim())return NaN;
 const s=value.trim();
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)){
  const [year,month,day]=s.slice(0,10).split('-').map(Number);
  const calendar=new Date(Date.UTC(year,month-1,day));
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return NaN;
  return Date.parse(s);
 }
 const uk=s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
 const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
 if(!uk&&!iso)return NaN;
 const values=uk?[uk[3],uk[2],uk[1],uk[4],uk[5],uk[6]||'00']:[iso[1],iso[2],iso[3],iso[4],iso[5],iso[6]||'00'];
 const [year,month,day,hour,minute,second]=values.map(Number);
 const wall=Date.UTC(year,month-1,day,hour,minute,second);
 const matches=[wall,wall-3600000].filter(time=>{const p=partsOf(time);return [p.year,p.month,p.day,p.hour,p.minute,p.second].map(Number).every((v,i)=>v===[year,month,day,hour,minute,second][i])});
 // Choose the older reading of the repeated autumn hour; nonexistent spring times are invalid.
 return matches.length?Math.min(...matches):NaN;
}
