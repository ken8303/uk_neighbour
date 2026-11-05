import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('cycle-hire and postcode journey tools are opt-in, handle failure and render on mobile',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-05T12:00:00Z')});
 let cycleCalls=0,journeyCalls=0,cycleFail=false,outside=false;
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/alerts/**',route=>{
 const u=new URL(route.request().url()),type=u.pathname.split('/').at(-1);
 if(type==='postcode')return route.fulfill({json:{location:{lat:51.5,lon:-.12,label:u.searchParams.get('postcode'),country:'England'}}});
 if(type==='cycle-hire'){
 cycleCalls++;if(cycleFail)return route.fulfill({status:502,json:{error:'Cycle service unavailable'}});
 return route.fulfill({json:{coverageEligible:true,excluded:1,total:1,stations:[{id:'BikePoints_1',name:'Test Dock',lat:51.5,lon:-.12,distanceMetres:120,bikes:0,emptyDocks:8,reportedAt:'2026-11-05T11:55:10Z'}]}});
 }
 if(type==='journey'){
 journeyCalls++;return route.fulfill({json:{coverageEligible:!outside,total:outside?0:1,journeys:outside?[]:[{id:'one',duration:20,start:'2026-11-05T12:01:00Z',arrival:'2026-11-05T12:21:00Z',legs:[{summary:'Walk to Test Station',mode:'walking',duration:5,notices:[]},{summary:'Take the Test line',mode:'tube',duration:15,disrupted:true,notices:['Test works on route']}]}]}});
 }
 if(['floods','transport','buses'].includes(type))return route.fulfill({json:{items:[],coverageEligible:true}});
 return route.fulfill({status:502,json:{error:'Fixture unavailable'}});
 });
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');assert.equal(await page.title(),'Neighbour — Alerts near you');
 await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('Filter other alert types').selectOption('transport');
 assert.equal(cycleCalls,0);assert.equal(journeyCalls,0);
 await page.getByText('Nearby cycle-hire availability · London',{exact:true}).click();const cycles=page.locator('.cycle-hire');await cycles.getByText('0 bikes',{exact:true}).waitFor();await cycles.getByText('8 empty docking spaces',{exact:true}).waitFor();assert.match(await cycles.innerText(),/Some nearby stations were excluded/);
 await page.getByText('Plan a public transport journey · London',{exact:true}).click();const planner=page.locator('.journey-planner');
 await page.getByLabel('Destination postcode',{exact:true}).fill('bad');await page.getByRole('button',{name:'Plan journey',exact:true}).click();await planner.getByRole('alert').waitFor();assert.equal(journeyCalls,0);
 await page.getByLabel('Destination postcode',{exact:true}).fill('EC1A 1BB');await page.getByRole('button',{name:'Plan journey',exact:true}).click();await planner.getByRole('heading',{name:'Option 1 · 20 min',exact:true}).waitFor();await planner.getByText('Test works on route',{exact:true}).waitFor();
 await planner.screenshot({path:'/tmp/journey-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await planner.screenshot({path:'/tmp/journey-mobile.png'});await cycles.screenshot({path:'/tmp/cycle-mobile.png'});
 cycleFail=true;await page.getByRole('button',{name:'Refresh cycle hire',exact:true}).click();await cycles.getByText('Showing a previous result',{exact:false}).waitFor();assert.equal(await planner.getByRole('heading',{name:'Option 1 · 20 min',exact:true}).count(),1);
 await page.clock.runFor(20000);await cycles.getByText('Some previous station reports have expired.',{exact:false}).waitFor();assert.equal(await cycles.getByText('0 bikes',{exact:true}).count(),0);
 await page.clock.runFor(65000);await planner.getByText('This suggested departure time has passed.',{exact:false}).waitFor();
 outside=true;await page.getByRole('button',{name:'Plan journey',exact:true}).click();await planner.getByText('This planner does not cover both locations.',{exact:false}).waitFor();assert.equal(await planner.locator('.journey-options').count(),0);
 assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);
 }finally{await browser.close()}
});
