import {execute,one,type Database} from './db.ts';
import {Retryable,Uncertain,Rejected} from './api.ts';
type Effect={state:string;result_json:string|null;updated_at:number};
export async function effect<T>(db:Database,key:string,action:()=>Promise<T>,safeToRepeat=false):Promise<T>{
 const existing=await one<Effect>(db,'SELECT * FROM effects WHERE id=?',key);
 if(existing?.state==='done')return JSON.parse(existing.result_json??'null') as T;
 if(existing?.state==='uncertain')throw new Uncertain('effect_requires_reconciliation');
 if(existing?.state==='rejected')throw new Rejected('effect_rejected');
 if(existing?.state==='running'){
  if(existing.updated_at>Date.now()/1000-60)throw new Retryable('effect_busy',60);
  if(!safeToRepeat){await execute(db,"UPDATE effects SET state='uncertain' WHERE id=? AND state='running'",key);throw new Uncertain('effect_crashed_ambiguous');}
  await execute(db,"DELETE FROM effects WHERE id=? AND state='running' AND updated_at<?",key,Math.floor(Date.now()/1000)-60);
 }
 const won=await execute(db,"INSERT INTO effects(id,state) VALUES (?,'running') ON CONFLICT(id) DO NOTHING",key);
 if(!won)throw new Retryable('effect_race',60);
 try{
  const result=await action();
  await execute(db,"UPDATE effects SET state='done',result_json=?,updated_at=unixepoch() WHERE id=?",JSON.stringify(result??null),key);
  return result;
 }catch(error){
  if(error instanceof Retryable||safeToRepeat){await execute(db,"DELETE FROM effects WHERE id=? AND state='running'",key);}
  else await execute(db,"UPDATE effects SET state=?,updated_at=unixepoch() WHERE id=?",error instanceof Rejected?'rejected':'uncertain',key);
  throw error;
 }
}
