import { handleAlertRequest } from './alert-handler.js';
function fail(res,status,error){
 if(res.writableEnded||res.destroyed)return;
 if(res.headersSent){res.destroy();return;}
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify({error}));
}
export function createAlertMiddleware(fetcher=fetch){
 return async function(req,res,next){
  let url;
  try{url=new URL(req.url,'http://localhost').href}catch{fail(res,400,'Invalid URL');return;}
  try{
   const response=await handleAlertRequest({url,method:req.method},fetcher);
   if(!response){await next();return;}
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(await response.text());
  }catch{fail(res,500,'An unexpected server error occurred.');}
 };
}
