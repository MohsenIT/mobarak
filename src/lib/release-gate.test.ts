import {expect,test} from 'bun:test'
// @ts-ignore The release gate is also executed directly by Node in Vercel.
import {decision} from '../../scripts/await-ci.mjs'
const sha='a'.repeat(40)
const run={head_sha:sha,head_branch:'main',event:'push',run_number:1,run_attempt:1,status:'completed',conclusion:'success'}
test('only successful push checks on the exact main commit permit release',()=>{
 expect(decision([run],sha)).toBe('pass')
 for(const overrides of [{head_sha:'b'.repeat(40)},{event:'pull_request'},{head_branch:'feature'},{status:'in_progress'}])expect(decision([{...run,...overrides}],sha)).toBe('wait')
 for(const conclusion of ['failure','cancelled','skipped','timed_out'])expect(decision([{...run,conclusion}],sha)).toBe('fail')
 expect(decision([run,{...run,run_attempt:2,status:'in_progress'}],sha)).toBe('wait')
 expect(decision([],sha)).toBe('wait')
})
