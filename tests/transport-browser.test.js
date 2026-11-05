import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
test('public transport exposes every candidate honestly and filters live bus route reports',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/alerts/**',r=>{
 const type=new URL(r.request().url()).pathname.split('/').at(-1);
 if(type==='postcode')return r.fulfill({json:{location:{lat:51.5,lon:-.12,label:'SW1A 1AA',country:'England'}}});
 if(type==='buses')return r.fulfill({json:{coverageEligible:true,items:['25','N15'].map(route=>({id:route,title:`Bus ${route}`,severity:'Special Service',description:'Fixture diversion',scope:'London bus route status · not a nearby-stop match',planned:true,link:'https://tfl.gov.uk/bus/status/'}))}});
 if(type==='transport'||type==='floods')return r.fulfill({json:{items:[],coverageEligible:true}});
 return r.fulfill({status:502,json:{error:'Test unavailable'}});
 });
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');assert.equal(await page.title(),'Neighbour — Alerts near you');
 await page.getByLabel('Filter other alert types').selectOption('transport');
 await page.getByText('Transport data sources & access',{exact:true}).click();
 const sources=page.locator('.transport-sources');
 assert.equal(await sources.locator('li').count(),7);
 await sources.getByText('Not connected · exact provider URL needed',{exact:true}).waitFor();
 await page.getByLabel('UK postcode').fill('SW1A 1AA');await page.getByRole('button',{name:'Search',exact:true}).click();
 const buses=page.locator('[aria-labelledby=category-buses]');
 await buses.getByRole('heading',{name:'Bus N15',exact:true}).waitFor();
 await page.getByLabel('Bus route (optional)').fill('25');
 assert.equal(await buses.getByRole('heading',{name:'Bus N15',exact:true}).count(),0);
 await buses.getByRole('heading',{name:'Bus 25',exact:true}).waitFor();
 await page.getByLabel('Bus route (optional)').fill('404');await buses.getByText('No entries in this result match that bus route.',{exact:false}).waitFor();
 await page.getByLabel('Bus route (optional)').fill('');
 await page.locator('.other-alerts').screenshot({path:'/tmp/transport-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await buses.screenshot({path:'/tmp/transport-mobile.png'});assert.equal(await page.locator('vite-error-overlay').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
