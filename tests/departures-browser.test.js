import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('departures load only on opening, switch stops and modes, mark failed refresh and expire old predictions',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-05T12:00:00Z')});
 let stopCalls=0,arrivalCalls=0,fail=false,country='England';
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/alerts/**',route=>{
 const u=new URL(route.request().url()),type=u.pathname.split('/').at(-1);
 if(type==='postcode')return route.fulfill({json:{location:{lat:country==='England'?51.5:55.95,lon:country==='England'?-.12:-3.19,label:country==='England'?'SW1A 1AA':'EH1 1AA',country}}});
 if(type==='stops'){
 stopCalls++;if(country!=='England')return route.fulfill({json:{coverageEligible:false,stops:[]}});
 return route.fulfill({json:{coverageEligible:true,stops:u.searchParams.get('kind')==='bus'?[{id:'490TEST01',name:'Test Road East',distanceMetres:120},{id:'490TEST02',name:'Test Road West',distanceMetres:180}]:[{id:'940GZZLUWSM',name:'Test Station',distanceMetres:450}]}});
 }
 if(type==='departures'){
 arrivalCalls++;if(fail)return route.fulfill({status:502,json:{error:'TfL unavailable'}});
 const id=u.searchParams.get('stop'),label=id==='490TEST01'?'East destination':id==='490TEST02'?'West destination':'Rail destination';
 return route.fulfill({json:{stopId:id,predictions:[{id:'fixture',line:id.startsWith('940')?'Circle':'11',destination:label,platform:'A',expectedArrival:'2026-11-05T12:03:00Z',reportedAt:'2026-11-05T11:59:45Z'}]}});
 }
 if(type==='transport'||type==='buses'||type==='floods')return route.fulfill({json:{items:[],coverageEligible:true}});
 return route.fulfill({status:502,json:{error:'Test unavailable'}});
 });
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');assert.equal(await page.title(),'Neighbour — Alerts near you');
 await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByLabel('Filter other alert types').selectOption('transport');
 const board=page.locator('.departure-board');assert.equal(stopCalls,0);assert.equal(arrivalCalls,0);
 await page.getByText('Nearby stops & live departures · London',{exact:true}).click();
 await board.getByText('East destination',{exact:true}).waitFor();
 await page.getByLabel('Nearby stop',{exact:true}).selectOption('490TEST02');await board.getByText('West destination',{exact:true}).waitFor();assert.equal(await board.getByText('East destination',{exact:true}).count(),0);
 await page.getByLabel('Stop type',{exact:true}).selectOption('rail');await board.getByText('Rail destination',{exact:true}).waitFor();
 await page.locator('.other-alerts').screenshot({path:'/tmp/departures-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await board.screenshot({path:'/tmp/departures-mobile.png'});
 fail=true;await page.getByRole('button',{name:'Refresh departures',exact:true}).click();await board.getByText('Showing a previous result',{exact:false}).waitFor();
 await page.getByLabel('Auto-refresh',{exact:true}).uncheck();
 await page.clock.runFor(61000);await board.getByText('Previous data expired.',{exact:false}).waitFor();assert.equal(await board.getByText('Rail destination',{exact:true}).count(),0);
 country='Scotland';await page.getByLabel('UK postcode').fill('EH1 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 await board.getByText('Nearby TfL departures are not connected for this area.',{exact:false}).waitFor();assert.equal(await board.locator('.departure-list').count(),0);
 assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);
 }finally{await browser.close()}
});
