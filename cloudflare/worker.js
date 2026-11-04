import { handleAlertRequest } from '../server/alert-handler.js';
export default {
 async fetch(request,env){
  const response=await handleAlertRequest(request);
  if(response)return response;
  return env.ASSETS.fetch(request);
 },
};
