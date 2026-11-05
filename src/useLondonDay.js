import {useEffect,useState} from 'react';
import {londonDate,nextLondonMidnight} from './calendar';
export function useLondonDay(){
 const [day,setDay]=useState(()=>londonDate());
 useEffect(()=>{
  let timer;
  function update(){clearTimeout(timer);setDay(londonDate());timer=setTimeout(update,Math.max(1,nextLondonMidnight()-Date.now()+5));}
  const resume=()=>{if(document.visibilityState!=='hidden')update()};
  update();document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',update);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('pageshow',update)};
 },[]);
 return day;
}
