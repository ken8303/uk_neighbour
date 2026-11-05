import {forecastFixture} from '../test-support/fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('automatic feeds pause when hidden/offline, resume, retain failed results and expire them honestly',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let calls=0,fail=false,latitude=51.5,hold=false,release,blocked;
  await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
  await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
  await page.route('**/api/alerts/air?**',r=>r.abort());
  await page.route('**/api/alerts/postcode?**',r=>r.fulfill({json:{location:{lat:latitude,lon:-.12,label:latitude===51.5?'SW1A 1AA':'CB1 1AA',country:'England'}}}));
  await page.route('**/api/alerts/flood*',r=>r.fulfill({json:{items:[]}}));
  await page.route('**/api/alerts/forecast?**',r=>r.fulfill({json:{days:forecastFixture({time:['2026-11-04'],weather_code:[0],temperature_2m_max:[12],temperature_2m_min:[7]})}}));
  await page.route(/\/api\/alerts\/(?:weather|traffic|highways|safety|transport|fuel)\?/,async r=>{
   if(r.request().url().includes('/weather?')){
    const number=++calls;
    if(hold&&new URL(r.request().url()).searchParams.get('lat')==='51.5'){blocked=true;await new Promise(resolve=>release=resolve);}
    try{return fail?r.fulfill({status:502,json:{}}):await r.fulfill({json:{items:[{id:'live',title:`Weather update ${number}`,scope:'Test feed',link:'https://www.metoffice.gov.uk/',severity:'Yellow'}]}})}catch{return;}
   }
   return r.fulfill({json:{items:[],neighbourhood:null,coverageEligible:true}});
  });
  await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('heading',{name:'Weather update 1',exact:true}).waitFor();
  await page.clock.runFor(61000);await page.getByRole('heading',{name:'Weather update 2',exact:true}).waitFor();
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.runFor(120000);assert.equal(calls,2);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.getByRole('heading',{name:'Weather update 3',exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'Auto-refresh'}).uncheck();await page.clock.runFor(61000);assert.equal(calls,3);
  await page.getByRole('checkbox',{name:'Auto-refresh'}).check();await page.getByRole('heading',{name:'Weather update 4',exact:true}).waitFor();
  fail=true;await page.getByRole('button',{name:'Refresh severe weather warnings'}).click();const weather=page.locator('[aria-labelledby=category-weather]');await weather.getByText('Showing a previous result',{exact:false}).waitFor();await page.getByRole('heading',{name:'Weather update 4',exact:true}).waitFor();
  const notice=await weather.getByText('Showing a previous result',{exact:false}).boundingBox(),entry=await page.getByRole('heading',{name:'Weather update 4',exact:true}).boundingBox();assert.ok(notice.y<entry.y);
  await page.screenshot({path:'/tmp/neighbour-live-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/neighbour-live-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('checkbox',{name:'Auto-refresh'}).uncheck();await page.clock.runFor(301000);await weather.getByText('Live feed unavailable.',{exact:false}).waitFor();assert.equal(await page.getByRole('heading',{name:'Weather update 4',exact:true}).count(),0);
  const before=calls;await context.setOffline(true);await page.getByText('Offline — waiting for a connection',{exact:true}).waitFor();await page.clock.runFor(61000);assert.equal(calls,before);
  fail=false;await context.setOffline(false);await page.getByRole('checkbox',{name:'Auto-refresh'}).check();await page.getByRole('heading',{name:`Weather update ${before+1}`,exact:true}).waitFor();
  hold=true;const heldNumber=calls+1;
  await page.getByRole('button',{name:'Refresh severe weather warnings'}).click();
  for(let i=0;!blocked&&i<50;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(blocked);
  latitude=52;await page.getByLabel('UK postcode').fill('CB1 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('heading',{name:`Weather update ${heldNumber+1}`,exact:true}).waitFor();
  release();await page.clock.runFor(100);
  assert.equal(await page.getByRole('heading',{name:`Weather update ${heldNumber}`,exact:true}).count(),0);

 }finally{await browser.close()}
});
