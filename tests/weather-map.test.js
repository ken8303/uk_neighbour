import {forecastFixture} from '../test-support/fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

test('forecast and flood map work independently with accessible mobile controls',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
 await page.route(/\/api\/alerts\/(?:weather|traffic|highways|safety|transport|fuel)\?/,r=>r.fulfill({status:502,json:{error:'Unavailable in this test'}}));let weatherFails=false,floodFails=false;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/alerts/air?**',r=>r.abort());
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/alerts/postcode?**',r=>r.fulfill({json:{location:{lat:51.5,lon:-0.12,label:'SW1A 1AA',country:'England'}}}));
 await page.route('**/api/alerts/flood*',r=>{
  if(floodFails)return r.fulfill({status:503,json:{}});
  if(r.request().url().includes('/flood-area?'))return r.fulfill({json:{items:{lat:51.52,long:-0.14}}});
  return r.fulfill({json:{items:[{floodAreaID:'TEST123',severityLevel:3,severity:'Flood Alert',description:'Test flood area'}]}});
 });
 await page.route('**/api/alerts/forecast?**',r=>{
  const url=new URL(r.request().url());assert.equal(url.searchParams.get('lat'),'51.5');
  if(weatherFails)return r.fulfill({status:503,json:{}});
  return r.fulfill({json:{days:forecastFixture({time:Array.from({length:7},(_,i)=>`2026-11-${String(4+i).padStart(2,'0')}`),weather_code:[61,2,0,3,45,71,95],temperature_2m_max:[12,13,14,11,9,7,10],temperature_2m_min:[7,8,8,5,3,1,4],precipitation_probability_max:[80,30,10,20,10,70,90]})}});
 });
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');
 await page.getByLabel('UK postcode').fill('SW1A 1AA');
 await page.getByLabel('Radius').selectOption('10');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByText('1 of 1 alerts located on the map.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('listitem').count(),7);
 await page.getByRole('img',{name:'Rain',exact:true}).waitFor();
 assert.match(await page.locator('.map-location').textContent(),/10 km/);
 assert.equal(await page.locator('.leaflet-overlay-pane path').count(),3);
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await page.getByRole('button',{name:'Reset view'}).click();
 await page.locator('.leaflet-interactive').last().click({force:true});
 await page.locator('.leaflet-popup-content').getByText('Test flood area',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close popup'}).click();
 await page.locator('.leaflet-popup').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Reset view'}).click();
 await page.screenshot({path:'/tmp/neighbour-map-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/neighbour-map-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 weatherFails=true;
 await page.getByRole('button',{name:'Refresh forecast'}).click();
 await page.locator('.forecast').getByText('Showing a previous result',{exact:false}).waitFor();
 await page.getByRole('heading',{name:'Test flood area',exact:true}).waitFor();
 weatherFails=false;floodFails=true;
 await page.getByRole('button',{name:'Refresh alerts'}).click();
 await page.locator('.results').getByText('Showing a previous result',{exact:false}).waitFor();
 await page.getByRole('listitem').first().waitFor();
 assert.equal(await page.getByRole('listitem').count(),7);
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
