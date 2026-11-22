import {APIs} from './api.ts';
import {execute,one} from './db.ts';
import {routingUpdate} from './worker.ts';
import type {BridgeEnv} from './bridge.ts';

// Official Bot API alternative to webhook delivery. No personal-account session.
// Persist every update before advancing the offset; delivery replay is harmless.
export async function pollBale(env:BridgeEnv):Promise<void>{
 if(env.BALE_TRANSPORT!=='polling'||env.BRIDGE_ENABLED!=='true')return;
 const now=Math.floor(Date.now()/1000);
 const acquired=await execute(env.DB,`INSERT INTO bridge_settings(key,value) VALUES ('bale_poll_lease',?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(bridge_settings.value AS INTEGER)<?`,String(now+55),now);
 if(!acquired)return;
 try{
  const api=new APIs(env);
  const checkpoint=await one<{value:string}>(env.DB,"SELECT value FROM bridge_settings WHERE key='bale_offset'");
  const offset=Number(checkpoint?.value??0);
  const updates=await api.bale<Record<string,unknown>[]>('getUpdates',{offset,limit:20,timeout:0},false);
  if(!Array.isArray(updates))throw new Error('invalid_bale_updates');
  if(!updates.length)return;
  const safe=updates.map(routingUpdate);
  await execute(env.DB,`INSERT OR IGNORE INTO events(id,source,kind,payload_json)
   SELECT 'bale:'||json_extract(value,'$.update_id'),'bale','update',value FROM json_each(?)`,JSON.stringify(updates));
  await execute(env.DB,`INSERT OR IGNORE INTO probe_events(update_id,routing_json)
   SELECT json_extract(value,'$.update_id'),value FROM json_each(?)`,JSON.stringify(safe));
  const next=Math.max(...safe.map(v=>Number(v.update_id)))+1;
  await execute(env.DB,"INSERT INTO bridge_settings(key,value) VALUES ('bale_offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(next));
 }finally{
  await execute(env.DB,"UPDATE bridge_settings SET value='0' WHERE key='bale_poll_lease'");
 }
}
