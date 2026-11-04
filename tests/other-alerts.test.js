import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('other alerts filter, refresh, partial failures and UK coverage render accurately',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let weatherError=false,scotland=false;
 await page.route('https://air-quality-api.open-meteo.com/**',r=>r.abort());
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('https://api.postcodes.io/**',r=>r.fulfill({json:{result:{latitude:scotland?55.95:51.5,longitude:scotland?-3.19:-.12,postcode:scotland?'EH1 1AA':'SW1A 1AA',country:scotland?'Scotland':'England'}}}));
 await page.route('https://environment.data.gov.uk/**',r=>r.fulfill({json:{items:[]}}));
 await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{daily:{time:['2026-11-04'],weather_code:[0],temperature_2m_max:[12],temperature_2m_min:[7]}}}));
 await page.route('**/api/alerts/**',r=>{
  const url=new URL(r.request().url());assert.equal(url.searchParams.get('lat'),scotland?'55.95':'51.5');assert.equal(url.searchParams.get('radius'),'25');
  const checkedAt='2026-11-04T12:00:00Z';
  if(url.pathname.endsWith('weather'))return weatherError?r.fulfill({status:502,json:{error:'Unavailable'}}):r.fulfill({json:{checkedAt,items:[{id:'weather1',title:'Test amber rain warning',severity:'Amber',scope:'UK feed · location not supplied',description:'Test fixture only',link:'https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings'}]}});
  if(url.pathname.endsWith('traffic'))return r.fulfill({json:{checkedAt,items:[{id:'road1',title:'Test road closure',severity:'Serious',scope:'TfL London roads · reported point within radius',description:'Test closure fixture',link:'https://tfl.gov.uk/traffic/status/'}]}});
  if(url.pathname.endsWith('transport'))return r.fulfill({json:{checkedAt,items:[],coverageEligible:true}});
  return r.fulfill({json:{checkedAt,neighbourhood:{name:'Test neighbourhood',link:'https://www.met.police.uk/area'}}});
 });
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');assert.equal(await page.title(),'Neighbour — Alerts near you');
 await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('heading',{name:'Test amber rain warning'}).waitFor();await page.getByRole('heading',{name:'Test road closure'}).waitFor();
 await page.getByText('Test neighbourhood',{exact:true}).waitFor();
 await page.getByText('UK feed · location not supplied',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Local police information'}).getAttribute('href'),'https://www.met.police.uk/area');
 await page.getByLabel('Filter other alert types').selectOption('traffic');assert.equal(await page.getByRole('heading',{name:'Test amber rain warning'}).count(),0);await page.getByRole('heading',{name:'Test road closure'}).waitFor();
 await page.getByLabel('Filter other alert types').selectOption('safety');await page.getByText('No live local incident feed is connected;',{exact:false}).waitFor();
 await page.getByLabel('Filter other alert types').selectOption('all');
 await page.screenshot({path:'/tmp/neighbour-other-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/neighbour-other-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 weatherError=true;await page.getByRole('button',{name:'Refresh severe weather warnings'}).click();await page.getByText('Live feed unavailable.',{exact:false}).waitFor();await page.getByRole('heading',{name:'Test road closure'}).waitFor();
 scotland=true;weatherError=false;await page.getByLabel('UK postcode').fill('EH1 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByText('This flood feed covers England only.',{exact:false}).waitFor();await page.getByRole('heading',{name:'Test amber rain warning'}).waitFor();
 assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);
 }finally{await browser.close()}
});
