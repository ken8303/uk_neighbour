import {forecastFixture} from '../test-support/fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('environment advisories, transport and official-only directories remain usable independently',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const externalAPI=[];page.on('request',r=>{if(/https:\/\/(?:api\.postcodes\.io|api\.open-meteo\.com|air-quality-api\.open-meteo\.com|environment\.data\.gov\.uk)/.test(r.url()))externalAPI.push(r.url())});const errors=[];page.on('pageerror',e=>errors.push(e.message));let airFails=false;
 await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/alerts/postcode?**',r=>r.fulfill({json:{location:{lat:51.5,lon:-.12,label:'SW1A 1AA',country:'England'}}}));
 await page.route('**/api/alerts/flood*',r=>r.fulfill({json:{items:[]}}));
 await page.route('**/api/alerts/forecast?**',r=>{
  const url=new URL(r.request().url());assert.equal(url.searchParams.get('lat'),'51.5');
  return r.fulfill({json:{days:forecastFixture({time:['2026-11-04','2026-11-05'],weather_code:[95,71],temperature_2m_max:[31,10],temperature_2m_min:[15,-1],precipitation_probability_max:[90,60],uv_index_max:[7,2],wind_gusts_10m_max:[65,20],precipitation_sum:[30,5]})}});
 });
 await page.route('**/api/alerts/air?**',r=>{
  if(airFails)return r.fulfill({status:503,json:{}});
  const time=Date.parse('2026-11-04T12:00:00Z')/1000;return r.fulfill({json:{current:{time,european_aqi:75,pm2_5:24,pm10:35},hourly:{time:Array.from({length:24},(_,i)=>time+(i+1)*3600),european_aqi:Array(24).fill(90)}}});
 });
 await page.route(/\/api\/alerts\/(?:weather|traffic|highways|safety|transport|buses|fuel)\?/,r=>r.fulfill({json:r.request().url().includes('/transport?')?{items:[{id:'central',title:'Central',severity:'Severe Delays',description:'Test line delay',scope:'London network-wide status · not a nearby-station match',link:'https://tfl.gov.uk/tube-dlr-overground/status/'}],coverageEligible:true}:{items:[],neighbourhood:null}}));
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 for(const title of ['UV protection advised','Hot weather forecast','Freezing temperatures forecast','Strong wind gusts forecast','Heavy daily rain forecast','Snow or snow showers forecast','Thunderstorms forecast'])await page.getByRole('heading',{name:title,exact:true}).waitFor();
 await page.locator('.air-current').getByText('Poor',{exact:true}).waitFor();await page.getByText('European AQI 75',{exact:true}).waitFor();
 await page.getByText('90 (Very poor)',{exact:false}).waitFor();
 await page.getByText('How these advisories are calculated',{exact:true}).click();await page.getByText('Thresholds are app rules, not Met Office or UKHSA warning criteria.',{exact:false}).waitFor();
 await page.getByLabel('Filter other alert types').selectOption('transport');await page.getByRole('heading',{name:'Central',exact:true}).waitFor();
 await page.getByLabel('Filter other alert types').selectOption('utilities');await page.getByText('Official links · not a live feed',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Scottish Water',exact:true}).getAttribute('href'),'https://www.scottishwater.co.uk/');
 await page.getByLabel('Filter other alert types').selectOption('health');await page.getByRole('link',{name:'Food recalls & allergy alerts'}).waitFor();
 await page.getByLabel('Filter other alert types').selectOption('all');
 await page.screenshot({path:'/tmp/neighbour-expanded-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/neighbour-expanded-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const flood=await page.locator('.results').boundingBox(),map=await page.locator('.map-panel').boundingBox();assert.ok(flood.y<map.y,'Flood alerts should precede the map and app advisories on mobile');
 airFails=true;await page.getByRole('button',{name:'Refresh air quality'}).click();await page.locator('.outlook-section').filter({has:page.getByRole('heading',{name:'Air quality',exact:true})}).getByText('Showing a previous result',{exact:false}).waitFor();await page.getByRole('heading',{name:'UV protection advised'}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(externalAPI,[],'Browser should use same-origin data APIs');
 }finally{await browser.close()}
});
