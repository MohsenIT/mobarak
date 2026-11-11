// Local integration only; synthetic events are not Bale capability evidence.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const secret = 'local-integration-secret-'.repeat(3);
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, scriptPath: 'dist/worker.js', compatibilityDate: '2026-11-09',
  d1Databases: { DB: 'probe' }, bindings: { BALE_WEBHOOK_SECRET: secret, ADMIN_SECRET: secret }
}));
try {
  const db = await mf.getD1Database('DB');
  for (const file of ['0001_phase_zero.sql','0002_bridge.sql']) await db.exec((await readFile('migrations/'+file, 'utf8')).replaceAll('\n', ' '));
  const post = () => mf.dispatchFetch(`https://probe.test/webhooks/bale/${secret}`, {
    method: 'POST', body: JSON.stringify({ update_id: 99, message: {
      message_id: 10, chat: { type: 'group', id: 5 }, text: 'PRIVATE', from: { id: 111 },
      reply_to_message: { message_id: 3, forward_from_chat: { type: 'channel', id: 7 }, forward_from_message_id: 1 }
    } })
  });
  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM probe_events').first<{n:number}>())?.n, 1);
  const read = await mf.dispatchFetch('https://probe.test/admin/events', { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(read.status, 200);
  const body = await read.text();
  assert.equal(body.includes('PRIVATE'), false);
  assert.equal(body.includes('111'), false);
  assert.equal(body.includes('forward_from_message_id'), true);
  console.log('PASS: Worker runtime + D1 migration, deduplication, authenticated evidence and privacy');
} finally { await mf.dispose(); }
