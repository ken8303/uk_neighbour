import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
const calm={code:0,high:12,low:4,uv:1,gust:10,precipitation:1};
test('GPS checks country coverage and fails closed while forecasts remain available',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const country of ['Scotland','Wales','Northern Ireland',null,'lookup-failed','England']){
   const context=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:55.9533,longitude:-3.1883},permissions:['geolocation']});const page=await context.newPage();let floodCalls=0;
   await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
   await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
   await page.route('**/api/alerts/**',r=>{
    const type=new URL(r.request().url()).pathname.split('/').at(-1);
    if(type==='location')return country==='lookup-failed'?r.fulfill({status:502,json:{}}):r.fulfill({json:{location:{country}}});
    if(type==='floods'){floodCalls++;return r.fulfill({json:{items:[]}})}
    if(type==='forecast')return r.fulfill({json:{days:[{...calm,date:'2026-11-04'},{...calm,date:'2026-11-05'}]}});
    if(type==='air')return r.fulfill({status:502,json:{}});
    return r.fulfill({json:{items:[],neighbourhood:null,coverageEligible:false}});
   });
   await page.goto(base);await page.getByRole('button',{name:'Use my location'}).click();
   if(country==='England'){await page.getByText('No Environment Agency alerts matched this England-only search.',{exact:true}).waitFor();assert.equal(floodCalls,1)}
   else{
    await page.locator('.results').getByText(country===null||country==='lookup-failed'?'Flood coverage could not be confirmed.':'This flood feed covers England only.',{exact:false}).waitFor();
    assert.equal(floodCalls,0);assert.equal(await page.getByText('0 active alerts near your current location',{exact:true}).count(),0);
   }
   await page.locator('.forecast-day').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(country==='Scotland')await page.locator('.results').screenshot({path:'/tmp/fixed-gps-coverage.png'});
   await context.close();
  }
 }finally{await browser.close()}
});
test('London midnight removes yesterday in any browser timezone and respects refresh pause',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const auto of [true,false]){
   const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Los_Angeles'}),page=await context.newPage();let calls=0;
   await page.clock.install({time:new Date('2026-11-04T23:59:30Z')});
   await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
   await page.route('**/api/alerts/**',r=>{
    const type=new URL(r.request().url()).pathname.split('/').at(-1);
    if(type==='postcode')return r.fulfill({json:{location:{lat:51.5,lon:-.12,label:'SW1A 1AA',country:'England'}}});
    if(type==='forecast'){calls++;return r.fulfill({json:{days:calls===1?[{...calm,date:'2026-11-04',code:95},{...calm,date:'2026-11-05'},{...calm,date:'2026-11-06'}]:[{...calm,date:'2026-11-05'},{...calm,date:'2026-11-06'},{...calm,date:'2026-11-07'}]}})}
    if(type==='air')return r.fulfill({status:502,json:{}});
    return r.fulfill({json:{items:[],neighbourhood:null,coverageEligible:false}});
   });
   await page.goto(base);await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
   await page.getByRole('heading',{name:'Thunderstorms forecast',exact:true}).waitFor();assert.equal(await page.locator('.forecast-day').first().locator('time').getAttribute('datetime'),'2026-11-04');
   if(!auto)await page.getByRole('checkbox',{name:'Auto-refresh'}).uncheck();
   await page.clock.runFor(31000);
   await expect.poll(()=>calls).toBe(auto?2:1);
   await page.locator('.forecast-day').first().locator('time[datetime="2026-11-05"]').waitFor();assert.equal(await page.locator('.forecast-day').first().locator('h3').innerText(),'Today');
   assert.equal(await page.getByRole('heading',{name:'Thunderstorms forecast',exact:true}).count(),0);assert.equal(await page.locator('.forecast time[datetime="2026-11-04"]').count(),0);
   if(!auto){await page.setViewportSize({width:390,height:844});await page.locator('.forecast').screenshot({path:'/tmp/fixed-midnight-forecast.png'});}
   await context.close();
  }
 }finally{await browser.close()}
});
