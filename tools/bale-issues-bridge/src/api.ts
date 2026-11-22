export class Retryable extends Error {
 delay:number;
 constructor(code:string,delay=30){super(code);this.delay=delay;}
}
export class Uncertain extends Error {}
export class Rejected extends Error {}
export interface ApiEnv {BALE_TOKEN:string;GITHUB_TOKEN:string;GITHUB_REPO:string;}
export class APIs {
 env:ApiEnv;
 constructor(env:ApiEnv){this.env=env;}
 async bale<T>(method:string,data:Record<string,unknown>,write=true):Promise<T>{
  let response:Response;
  try {response=await fetch(`https://tapi.bale.ai/bot${this.env.BALE_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15_000)});}
  catch {throw write?new Uncertain('bale_network_ambiguous'):new Retryable('bale_network');}
  const body=await response.json().catch(()=>undefined) as {ok?:boolean;result:T;error_code?:number;parameters?:{retry_after?:number};description?:string}|undefined;
  if(response.status===429||body?.error_code===429)throw new Retryable('bale_rate_limit',body?.parameters?.retry_after??60);
  if(!body){if(write)throw new Uncertain('bale_invalid_response');throw new Retryable('bale_invalid_response');}
  if(body.ok!==true&&method.startsWith('edit')&&/message is not modified/i.test(body.description??''))return true as T;
  if(!response.ok||body.ok!==true){
   if(response.status>=500||Number(body.error_code)>=500){if(write)throw new Uncertain('bale_server_ambiguous');throw new Retryable('bale_server');}
   throw new Rejected('bale_rejected_'+String(body.error_code??response.status));
  }
  return body.result;
 }
 async github<T>(path:string,method='GET',data?:unknown):Promise<T>{
  let response:Response;
  try {response=await fetch('https://api.github.com'+path,{method,headers:{Authorization:`Bearer ${this.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'mobarak-bale-issues-bridge','Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15_000)});}
  catch {throw method==='POST'?new Uncertain('github_network_ambiguous'):new Retryable('github_network');}
  if(response.status===429||(response.status===403&&(response.headers.get('x-ratelimit-remaining')==='0'||response.headers.has('retry-after')))){
   const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
   throw new Retryable('github_rate_limit',Math.max(Number(response.headers.get('retry-after'))||0,60,Math.ceil((reset-Date.now())/1000)||60));
  }
  if(response.status>=500){if(method==='POST')throw new Uncertain('github_server_ambiguous');throw new Retryable('github_server');}
  if(!response.ok)throw new Rejected('github_rejected_'+response.status);
  if(response.status===204)return undefined as T;
  try{return await response.json() as T;}catch{throw method==='POST'?new Uncertain('github_response_ambiguous'):new Retryable('github_response');}
 }
 repo(path:string):string{return `/repos/${this.env.GITHUB_REPO}${path}`;}
}
