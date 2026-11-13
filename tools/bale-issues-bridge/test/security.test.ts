import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyGitHubSignature} from '../src/security.ts';
test('verifies the GitHub documented vector and rejects altered bytes and malformed headers',async()=>{
 const body=new TextEncoder().encode('Hello, World!');
 const signature='sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
 const secret="It's a Secret to Everybody";
 assert.equal(await verifyGitHubSignature(body,signature,secret),true);
 assert.equal(await verifyGitHubSignature(new TextEncoder().encode('Changed'),signature,secret),false);
 for(const header of [null,'sha1=abc','sha256=xyz',signature+'ff'])assert.equal(await verifyGitHubSignature(body,header,secret),false);
});
