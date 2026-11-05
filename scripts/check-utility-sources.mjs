// Run with Node 18+ on a machine that can reach the providers.
// Reports response structure only; no postcode or account data is sent.
const sources = [
 ['SSEN','https://external.distribution.prd.ssen.co.uk/opendataportal-prd/v4/api/getallfaults'],
 ['Thames Water','https://www.thameswater.co.uk/network-latest'],
 ['Food Standards Agency','https://data.food.gov.uk/food-alerts/id.json?_limit=2&_sort=-created'],
];
for (const [name,url] of sources) {
 try {
  const response = await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json, text/html'}});
  const body = await response.text();
  console.log(`${name}: HTTP ${response.status}; content-type ${response.headers.get('content-type')||'unknown'}`);
  if (!response.ok) continue;
  try {
   const value=JSON.parse(body);
   const shape=v=>Array.isArray(v)?{type:'array',length:v.length,first:v.length?shape(v[0]):null}:v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,Array.isArray(x)?{type:'array',length:x.length,first:x.length?shape(x[0]):null}:x&&typeof x==='object'?shape(x):typeof x])):typeof v;
   console.log(JSON.stringify(shape(value),null,2).slice(0,12000));
  } catch {
   const heading=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(body);
   const links=[...body.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].filter(m=>m[2].includes('/network-latest/'));
   console.log(JSON.stringify({heading:heading?.[1].replace(/<[^>]*>/g,' ').trim()||null,incidentLinkCount:links.length,firstIncidentLink:links[0]?{href:links[0][2],text:links[0][3].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}:null}));
  }
 } catch (error) { console.log(`${name}: ${error.name}: ${error.message}`); }
}
