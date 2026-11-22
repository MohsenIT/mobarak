// Phase-zero only: no publishing, GitHub writes, user content or sender identity stored.
type RecordValue = Record<string, unknown>;
export interface Statement {
  bind(...args: unknown[]): Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface Env {
  DB: { prepare(sql: string): Statement };
  BALE_WEBHOOK_SECRET: string;
  ADMIN_SECRET: string;
}
const object = (v: unknown): RecordValue | undefined =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? v as RecordValue : undefined;
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

function routingMessage(value: unknown, depth = 0): RecordValue | undefined {
  const message = object(value);
  if (!message || depth > 2) return undefined;
  const out: RecordValue = {};
  for (const key of ['message_id', 'message_thread_id', 'forward_from_message_id']) {
    if (id(message[key])) out[key] = message[key];
  }
  for (const key of ['chat', 'forward_from_chat', 'sender_chat']) {
    const chat = object(message[key]);
    if (!chat) continue;
    const type = chat.type;
    if (type === 'private') out[key] = { type };
    else if (['group', 'supergroup', 'channel'].includes(String(type)) && id(chat.id)) {
      out[key] = { type, id: chat.id };
    }
  }
  const reply = routingMessage(message.reply_to_message, depth + 1);
  if (reply) out.reply_to_message = reply;
  const origin = object(message.forward_origin);
  if (origin && ['user', 'hidden_user', 'chat', 'channel'].includes(String(origin.type))) {
    const safeOrigin: RecordValue = { type: origin.type };
    if (origin.type === 'channel') {
      if (id(origin.message_id)) safeOrigin.message_id = origin.message_id;
      const chat = object(origin.chat);
      if (chat?.type === 'channel' && id(chat.id)) safeOrigin.chat = { type: 'channel', id: chat.id };
    }
    out.forward_origin = safeOrigin;
  }
  return out;
}

export function routingUpdate(value: unknown): RecordValue {
  const update = object(value);
  if (!update || !id(update.update_id)) throw new Error('invalid update');
  const out: RecordValue = { update_id: update.update_id };
  for (const key of ['message', 'edited_message', 'channel_post', 'edited_channel_post']) {
    const message = routingMessage(update[key]);
    if (message) out[key] = message;
  }
  return out;
}

async function secretEquals(actual: string, expected: string | undefined): Promise<boolean> {
  if (!expected || expected.length < 32) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('missing body');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65_536) { await reader.cancel(); throw new Error('body too large'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') {
      return Response.json({ service: 'bale-github-bridge', stage: 'phase-zero', bridge_enabled: false });
    }
    if (path === '/admin/events' && request.method === 'GET') {
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
      if (!await secretEquals(token, env.ADMIN_SECRET)) return new Response('Not found', { status: 404 });
      try {
        const { results } = await env.DB.prepare('SELECT update_id, received_at, routing_json FROM probe_events ORDER BY update_id DESC LIMIT 100').all();
        return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
      } catch { return new Response('Storage unavailable', { status: 503 }); }
    }
    const prefix = '/webhooks/bale/';
    if (request.method !== 'POST' || !path.startsWith(prefix) ||
        !await secretEquals(path.slice(prefix.length), env.BALE_WEBHOOK_SECRET)) {
      return new Response('Not found', { status: 404 });
    }
    let routing: RecordValue;
    try { routing = routingUpdate(await boundedJson(request)); }
    catch { return new Response('Invalid update', { status: 400 }); }
    try {
      // Acknowledge only after durable storage. Repeated updates are safe.
      await env.DB.prepare('INSERT INTO probe_events (update_id, routing_json) VALUES (?, ?) ON CONFLICT(update_id) DO NOTHING')
        .bind(routing.update_id, JSON.stringify(routing)).run();
      return Response.json({ ok: true });
    } catch { return new Response('Storage unavailable', { status: 503 }); }
  }
};
