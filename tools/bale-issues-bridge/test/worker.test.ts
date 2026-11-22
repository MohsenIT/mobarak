import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { routingUpdate, type Env, type Statement } from '../src/worker.ts';
const secret = 's'.repeat(40);
function setup(fail = false) {
  const rows = new Map<unknown, unknown>();
  let values: unknown[] = [];
  const statement: Statement = {
    bind(...args) { values = args; return this; },
    async run() { if (fail) throw new Error('database down'); if (!rows.has(values[0])) rows.set(values[0], values[1]); },
    async all<T>() { return { results: [...rows.values()] as T[] }; }
  };
  const env: Env = { BALE_WEBHOOK_SECRET: secret, ADMIN_SECRET: secret, DB: { prepare: () => statement } };
  return { env, rows };
}
const request = (body: unknown, token = secret) => new Request(`https://probe.test/webhooks/bale/${token}`, {
  method: 'POST', body: JSON.stringify(body)
});
test('preserves comment-parent mapping and removes content and identity recursively', () => {
  const safe = routingUpdate({ update_id: 4, message: { message_id: 8, text: 'PRIVATE', from: { id: 111, first_name: 'PRIVATE' },
    chat: { id: 222, type: 'private' }, reply_to_message: { message_id: 3, text: 'PRIVATE',
      forward_from_chat: { id: 555, type: 'channel', title: 'PRIVATE' }, forward_from_message_id: 1 } } });
  assert.equal(JSON.stringify(safe).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(safe).includes('222'), false);
  assert.deepEqual((safe.message as Record<string,unknown>).reply_to_message,
    { message_id: 3, forward_from_message_id: 1, forward_from_chat: { type: 'channel', id: 555 } });
});
test('unauthenticated requests cannot write or read evidence', async () => {
  const { env, rows } = setup();
  assert.equal((await worker.fetch(request({ update_id: 4 }, 'wrong'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://probe.test/admin/events'), env)).status, 404);
  assert.equal(rows.size, 0);
});
test('replayed delivery records one event and acknowledges both', async () => {
  const { env, rows } = setup();
  for (let i = 0; i < 2; i++) assert.equal((await worker.fetch(request({ update_id: 4 }), env)).status, 200);
  assert.equal(rows.size, 1);
});
test('storage failure returns retryable failure instead of losing event', async () => {
  const { env } = setup(true);
  assert.equal((await worker.fetch(request({ update_id: 4 }), env)).status, 503);
});
test('invalid IDs and oversized payloads never reach storage', async () => {
  const { env, rows } = setup();
  for (const body of [{update_id: -1}, {update_id: 1.1}, {update_id: 1, text: 'x'.repeat(70_000)}]) {
    assert.equal((await worker.fetch(request(body), env)).status, 400);
  }
  assert.equal(rows.size, 0);
});
