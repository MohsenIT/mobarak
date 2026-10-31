// Vercel's production build must wait for this exact commit's browser + unit
// workflow. GitHub Actions itself calls `build` directly, avoiding a cycle.
export function decision(runs, sha) {
 const run = runs.filter(run => run.head_sha === sha && run.head_branch === 'main' && run.event === 'push')
  .sort((a,b) => b.run_number-a.run_number || (b.run_attempt??1)-(a.run_attempt??1))[0];
 if (!run || run.status !== 'completed') return 'wait';
 return run.conclusion === 'success' ? 'pass' : 'fail';
}
async function main() {
 const sha=process.env.VERCEL_GIT_COMMIT_SHA;
 if(!/^[a-f0-9]{40}$/.test(sha??''))throw new Error('Missing exact deployment commit; refusing release');
 if(process.env.VERCEL_ENV!=='production')return;
 const url=new URL('https://api.github.com/repos/MohsenIT/mobarak/actions/workflows/build.yml/runs');
 url.searchParams.set('head_sha',sha);url.searchParams.set('event','push');url.searchParams.set('per_page','20');
 for(let attempt=0;attempt<40;attempt++){
  const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Cannot verify CI (${response.status}); refusing release`);
  const state=decision((await response.json()).workflow_runs??[],sha);
  if(state==='pass'){console.log('Unit and browser checks passed for deployment commit.');return}
  if(state==='fail')throw new Error('Unit/browser workflow failed; refusing release');
  console.log('Waiting for unit and browser checks on deployment commit.');
  await new Promise(resolve=>setTimeout(resolve,30000));
 }
 throw new Error('CI verification timed out; refusing release');
}
if(import.meta.url===new URL(process.argv[1],'file:').href)main().catch(error=>{console.error(error.message);process.exitCode=1});
