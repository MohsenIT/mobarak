// Learned from real phase-zero events: channel mirrors have no forward metadata.
// Match only the configured channel's system sender and an exact, unique public body.
export interface PostedBody {
  channelPostId: number;
  body: string;
}
export interface MirrorSource {
  groupId: number;
  channelUsername: string;
}
export interface MirrorMatch {
  channelPostId: number;
  groupRootId: number;
}
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : undefined;
const validId = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;

export function matchChannelMirror(message: unknown, source: MirrorSource, posts: readonly PostedBody[]): MirrorMatch | undefined {
  const m = obj(message), chat = obj(m?.chat), from = obj(m?.from);
  if (!m || chat?.id !== source.groupId || chat.type !== 'group' || from?.is_bot !== true ||
      from.username !== source.channelUsername.replace(/^@/, '') || !validId(m.message_id) ||
      typeof m.text !== 'string' || m.reply_to_message !== undefined) return undefined;
  const matches = posts.filter(p => p.body === m.text);
  const ids = new Set(matches.map(p => p.channelPostId));
  if (ids.size !== 1) return undefined; // Never resolve an ambiguous root by timing/order.
  const channelPostId = matches[0].channelPostId;
  if (!validId(channelPostId)) return undefined;
  return { channelPostId, groupRootId: m.message_id };
}

export function resolveCommentRoot(message: unknown, groupId: number): number | undefined {
  const m = obj(message), chat = obj(m?.chat);
  if (!m || chat?.id !== groupId || chat.type !== 'group') return undefined;
  return validId(m.message_thread_id) ? m.message_thread_id : undefined;
}
