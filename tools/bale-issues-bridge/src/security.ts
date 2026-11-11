export async function verifyGitHubSignature(body: Uint8Array, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !/^sha256=[0-9a-f]{64}$/.test(signature) || secret.length < 20) return false;
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, v => Number.parseInt(v, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('HMAC',key,bytes,body as Uint8Array<ArrayBuffer>);
}
export async function digest(text:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function aliasFor(userId:number,secret:string):Promise<string>{
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('bale-user:'+userId)));
 return 'کاربر بله '+[...bytes.slice(0,4)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function secretMatches(actual:string,expected:string|undefined):Promise<boolean>{
 if(!expected||expected.length<32||actual.length<32)return false;
 const algorithm={name:'HMAC',hash:'SHA-256'};
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(expected),algorithm,false,['sign']);
 const candidate=await crypto.subtle.importKey('raw',new TextEncoder().encode(actual),algorithm,false,['verify']);
 const message=new TextEncoder().encode('mobarak-request-authentication');
 return crypto.subtle.verify('HMAC',candidate,await crypto.subtle.sign('HMAC',key,message),message);
}
