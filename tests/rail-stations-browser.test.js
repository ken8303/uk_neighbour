import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('GB rail finder searches without a postcode and finds nearby Scottish stations using the real local dataset',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='fetch'&&!r.url().startsWith(process.env.TEST_BASE_URL||'http://127.0.0.1:5173'))external.push(r.url())});
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/alerts/**',route=>{
 const type=new URL(route.request().url()).pathname.split('/').at(-1);
 if(type==='rail-stations')return route.continue();
 if(type==='postcode')return route.fulfill({json:{location:{lat:55.95,lon:-3.19,label:'EH1 1AA',country:'Scotland'}}});
 return route.fulfill({status:502,json:{error:'Fixture unavailable'}});
 });
 const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';await page.goto(base);assert.equal(await page.title(),'Neighbour — Alerts near you');
 await page.getByLabel('Filter other alert types').selectOption('transport');
 await page.getByText('Find rail stations · England, Scotland & Wales',{exact:true}).click();const finder=page.locator('.rail-station-finder');
 await page.getByLabel('Station name or CRS code',{exact:true}).fill('x');await page.getByRole('button',{name:'Search rail stations',exact:true}).click();await finder.getByRole('alert').waitFor();
 await page.getByLabel('Station name or CRS code',{exact:true}).fill('EDB');await page.getByRole('button',{name:'Search rail stations',exact:true}).click();await finder.getByRole('heading',{name:'Edinburgh Waverley · EDB',exact:true}).waitFor();assert.match(await finder.innerText(),/7 October 2026/);assert.match(await finder.innerText(),/not live departures/);
 assert.equal(await finder.getByRole('link',{name:'Download reference data',exact:true}).getAttribute('href'),'/data/gb-rail-stations.json');
 await page.getByLabel('Station name or CRS code',{exact:true}).fill('Cardiff');await page.getByRole('button',{name:'Search rail stations',exact:true}).click();await finder.getByRole('heading',{name:'Cardiff Central · CDF',exact:true}).waitFor();assert.equal(await finder.getByRole('heading',{name:'Edinburgh Waverley · EDB',exact:true}).count(),0);
 await page.getByLabel('UK postcode').fill('EH1 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Find stations near my selected location',exact:true}).click();await finder.getByRole('heading',{name:'Edinburgh Waverley · EDB',exact:true}).waitFor();await finder.getByRole('heading',{name:'Haymarket · HYM',exact:true}).waitFor();assert.equal(await page.getByLabel('Station name or CRS code',{exact:true}).inputValue(),'');assert.match(await finder.innerText(),/0.2 km away/);
 await finder.screenshot({path:'/tmp/gb-rail-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await finder.screenshot({path:'/tmp/gb-rail-mobile.png'});
 const data=await page.request.get(base+'/data/gb-rail-stations.json');assert.equal(data.status(),200);assert.equal((await data.json()).length,2609);const licence=await page.request.get(base+'/data/gb-rail-stations-LICENSE.txt');assert.match(await licence.text(),/Open Database License/);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);
 }finally{await browser.close()}
});
