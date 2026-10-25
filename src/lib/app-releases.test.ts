import {describe,expect,test} from 'bun:test'
import {APP_RELEASES,CURRENT_RELEASE,compareRelease,missedReleases,parseAppUpdate} from './app-releases'
describe('release history',()=>{
 test('every skipped release is retained, newest first, with numeric semver order',()=>{
  const releases=Array.from({length:6},(_,i)=>({version:`0.3.${i+1}`,date:'2026-10-25',title:`test ${i}`,changes:[`change ${i}`]}))
  expect(missedReleases(releases,'0.3.0').map(r=>r.version)).toEqual(['0.3.6','0.3.5','0.3.4','0.3.3','0.3.2','0.3.1'])
  expect(missedReleases(releases,'0.3.3')).toHaveLength(3);expect(compareRelease('0.3.10','0.3.9')).toBe(1)
 })
 test('parses legacy build-only responses and rejects malformed history',()=>{
  expect(parseAppUpdate({version:'legacy'}).releases).toEqual([])
  expect(parseAppUpdate({version:'new',releases:[{version:'bad'},...APP_RELEASES,...APP_RELEASES]}).releases).toHaveLength(APP_RELEASES.length)
  expect(()=>parseAppUpdate({version:3})).toThrow()
 })
 test('published versions are unique and newest first with nonempty change notes',()=>{
  expect(CURRENT_RELEASE).toBe(APP_RELEASES[0].version)
  expect(new Set(APP_RELEASES.map(r=>r.version)).size).toBe(APP_RELEASES.length)
  for(const [i,r] of APP_RELEASES.entries()){expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);expect(r.changes.length).toBeGreaterThan(0);if(i>0)expect(compareRelease(APP_RELEASES[i-1].version,r.version)).toBe(1)}
 })
})
