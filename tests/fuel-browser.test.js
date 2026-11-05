import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('fuel comparison switches grade, qualifies partial coverage and handles failure on mobile',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
 let fail=false;
 await page.route('**/api/alerts/**',async route=>{
 const url=new URL(route.request().url()),type=url.pathname.split('/').at(-1);
 if(type==='postcode')return route.fulfill({json:{location:{lat:51.5,lon:-0.12,label:'SW1A 1AA',country:'England'}}});
 if(type==='floods')return route.fulfill({json:{items:[]}});
 if(type!=='fuel')return route.fulfill({status:502,json:{error:'Test unavailable'}});
 if(fail)return route.fulfill({status:502,json:{error:'Fuel-price sources unavailable'}});
 const grade=url.searchParams.get('fuel');
 return route.fulfill({json:{availability:'available',partial:true,fuel:grade,stations:[{id:'test',brand:'Test Forecourt',address:'Test Road',postcode:'SW1A 1AA',lat:51.5,lon:-0.12,pricePence:grade==='E10'?139.9:159.9,distanceKm:1.2,reportedAt:'2026-11-04T11:00:00Z',timestampKind:'feed',source:'Test retailer'}],total:1,sources:[{id:'test',name:'Test retailer',status:'connected'},{id:'missing',name:'Missing retailer',status:'unavailable'}]}});
 });
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');
 await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 const panel=page.locator('.fuel-prices');
 await panel.getByText('139.9p',{exact:true}).waitFor();
 assert.match(await panel.innerText(),/partial coverage/);
 assert.match(await panel.getByRole('link',{name:/Directions to/}).getAttribute('href'),/destination=51.5,-0.12/);
 await page.getByLabel('Fuel type').selectOption('B7');await panel.getByText('159.9p',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await panel.screenshot({path:'/tmp/fuel-mobile.png'});
 fail=true;await page.getByRole('button',{name:'Refresh fuel prices'}).click();
 await panel.getByText('Previous lowest reported price · B7 diesel',{exact:true}).waitFor();
 assert.match(await panel.innerText(),/latest refresh failed/);
 }finally{await browser.close()}
});
