import type {BridgeEnv} from './bridge.ts';
// Reception runs on a fixed cadence, independently of slow analysis. One drain
// stays active at a time to preserve conversational order. Each has its own D1 budget.
export async function pollingLoop(env:BridgeEnv,clock=()=>Date.now(),sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))):Promise<void>{
 if(!env.PUMP||env.BALE_TRANSPORT!=='polling'||env.BRIDGE_ENABLED!=='true')return;
 const deadline=clock()+58_000;let processing:Promise<void>|undefined;
 const call=async(path:string)=>{const response=await env.PUMP!.fetch('https://bridge.internal'+path,{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_SECRET}});await response.arrayBuffer();};
 try{
  for(let tick=0;tick<20&&clock()<deadline;tick++){
   const started=clock();
   try{await call('/admin/poll');}catch{/* Retry reception next tick; offsets stay durable. */}
   if(!processing)processing=call('/admin/drain').catch(()=>undefined).finally(()=>{processing=undefined;});
   const pause=Math.max(0,3_000-(clock()-started));
   if(clock()+pause>=deadline)break;
   if(pause)await sleep(pause);
  }
 }finally{await processing;}
}
