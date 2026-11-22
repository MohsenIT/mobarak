import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchChannelMirror, resolveCommentRoot } from '../src/bale-routing.ts';
const source = { groupId: 4961157767, channelUsername: 'mobarak_issues' };
const publicBody = '#42 — موضوع\nGitHub Issue: https://github.com/example/project/issues/42';
const mirror = { message_id: 16, chat: {id: source.groupId, type:'group'},
  from: { is_bot: true, username: source.channelUsername }, text: publicBody };
const posts = [{channelPostId:15,body:publicBody}];
test('matches official channel mirror without guessed IDs or timestamps', () => {
  assert.deepEqual(matchChannelMirror(mirror,source,posts),{channelPostId:15,groupRootId:16});
});
test('rejects user copy, wrong group, wrong channel, reply and ambiguous public body', () => {
  for (const message of [
    {...mirror,from:{is_bot:false,username:source.channelUsername}},
    {...mirror,from:{is_bot:true,username:'other_channel'}},
    {...mirror,chat:{id:99,type:'group'}},
    {...mirror,reply_to_message:{message_id:2}},
    {...mirror,text:'some other post'}
  ]) assert.equal(matchChannelMirror(message,source,posts),undefined);
  assert.equal(matchChannelMirror(mirror,source,[...posts,{channelPostId:20,body:publicBody}]),undefined);
});
test('nested replies resolve by observed thread, not immediate parent or zero root', () => {
  assert.equal(resolveCommentRoot({chat:mirror.chat,message_thread_id:7,reply_to_message:{message_id:8}},source.groupId),7);
  assert.equal(resolveCommentRoot({chat:mirror.chat,reply_to_message:{message_id:0}},source.groupId),undefined);
});
