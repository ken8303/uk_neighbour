import { handleAlertRequest } from './alert-handler.js';
export function createAlertMiddleware(fetcher=fetch){
 return async function(req,res,next){
  const response=await handleAlertRequest({url:new URL(req.url,'http://localhost').href,method:req.method},fetcher);
  if(!response)return next();
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(await response.text());
 };
}
