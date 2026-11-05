import {forecastFixture} from '../test-support/fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
test('location, postcode, alerts, refresh, failures and mobile layout', async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},geolocation:{latitude:51.5,longitude:-0.12},permissions:['geolocation']});
 const page=await context.newPage();
 await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
 await page.route(/\/api\/alerts\/(?:weather|traffic|highways|safety|transport|fuel)\?/,r=>r.fulfill({status:502,json:{error:'Unavailable in this test'}}));
 let floods=0, mode='alerts';
 await page.route('**/api/alerts/location?**',r=>r.fulfill({json:{location:{country:'England'}}}));
 await page.route('**/api/alerts/forecast?**',route=>route.fulfill({json:{days:forecastFixture({time:['2026-11-04'],weather_code:[61],temperature_2m_max:[12],temperature_2m_min:[7],precipitation_probability_max:[80]})}}));
 await page.route('**/api/alerts/air?**',r=>r.abort());
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.route('**/api/alerts/postcode?**',route=>route.fulfill({json:{location:{lat:51.5,lon:-0.12,label:'SW1A 1AA',country:'England'}}}));
 await page.route('**/api/alerts/flood*',route=>{
  floods++; const url=new URL(route.request().url()); assert.equal(url.searchParams.get('radius'),'25'); assert.equal(url.searchParams.get('lat'),'51.5');
  if(mode==='error')return route.fulfill({status:503,json:{error:'Unavailable'}});
  return route.fulfill({json:{items:mode==='empty'?[]:[{'@id':'test',severityLevel:2,severity:'Flood Warning',description:'Test river flood warning',message:'Test fixture: move to a safe place.',floodAreaID:'061WAFTEST',floodArea:{lat:51.51,long:-0.13},timeMessageChanged:'2026-11-04T12:00:00Z'}]}});
 });
 await page.goto(base);
 await page.screenshot({path:'/tmp/neighbour-desktop.png',fullPage:true});
 await page.getByLabel('UK postcode').fill('wrong');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByText('Enter a valid UK postcode, such as SW1A 1AA.').waitFor();
 assert.equal(floods,0);
 await page.getByLabel('UK postcode').fill('SW1A 1AA');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('heading',{name:'Test river flood warning'}).waitFor();
 assert.match(await page.getByRole('link',{name:'View official advice'}).getAttribute('href'),/061WAFTEST$/);
 mode='empty';await page.getByRole('button',{name:'Refresh alerts'}).click();
 await page.getByText('No active alerts found in this search.').waitFor();
 mode='error';await page.getByRole('button',{name:'Refresh alerts'}).click();
 await page.locator('.results').getByText('Showing a previous result',{exact:false}).waitFor();
 mode='alerts';await page.getByRole('button',{name:'Use my location'}).click();
 await page.getByText('1 Environment Agency alert matched this England-only search.').waitFor();
 await page.setViewportSize({width:390,height:844});await page.reload();
 await page.screenshot({path:'/tmp/neighbour-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await context.clearPermissions();
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_,error)=>error({code:1})});
 await page.getByRole('button',{name:'Use my location'}).click();
 await page.getByText('Location permission was denied. You can enter your postcode instead.').waitFor();
 await context.close();
 }finally{await browser.close()}
});
