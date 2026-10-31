import {spawn} from 'node:child_process';
const run=(command,args,env={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',env:{...process.env,...env}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited ${code}`)))});
let server;
try {
 await run('bun',['test','src/lib']);
 await run('bun',['run','build']);
 server=spawn(process.execPath,['.next/standalone/server.js'],{stdio:'inherit',env:{...process.env,PORT:'3017',HOSTNAME:'127.0.0.1'}});
 let ready=false;
 for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error('Test server exited');try{ready=(await fetch('http://127.0.0.1:3017/api/version')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,500))}
 if(!ready)throw new Error('Test server did not become ready');
 await run(process.execPath,['node_modules/@playwright/test/cli.js','test','--project=chromium-phone','--project=chromium-desktop','--project=android-bridge-phone'],{READER_URL:'http://127.0.0.1:3017'});
 await run(process.execPath,['scripts/verify-desktop-reading.cjs'],{READER_URL:'http://127.0.0.1:3017'});
 await run(process.execPath,['scripts/verify-quick-highlights.cjs'],{READER_URL:'http://127.0.0.1:3017'});
} catch(error){console.error(error.message);process.exitCode=1} finally {server?.kill('SIGTERM')}
