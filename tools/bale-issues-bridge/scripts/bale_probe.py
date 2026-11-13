"""Official Bale API phase-zero probe. Python stdlib; never logs tokens/content."""
import argparse
import datetime
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.phase-zero'

def shape(value):
    """Keep routing evidence; remove user identity, message text and webhook URLs."""
    if isinstance(value, list):
        return [shape(x) for x in value]
    if not isinstance(value, dict):
        return value
    allowed = {'update_id', 'message_id', 'message_thread_id', 'linked_chat_id',
               'forward_from_message_id', 'type', 'is_bot', 'date', 'edit_date'}
    nested = {'message', 'edited_message', 'chat', 'sender_chat',
              'forward_from_chat', 'reply_to_message'}
    result = {k: shape(v) for k, v in value.items() if k in allowed or k in nested}
    if 'id' in value and value.get('type') in {'group', 'channel', 'supergroup'}:
        result['id'] = value['id']
    return result

class API:
    def __init__(self):
        path = ROOT / '.secrets/bale-token'
        self.token = os.environ.get('BALE_TOKEN') or path.read_text().strip()
        if not self.token or '/' in self.token or '\n' in self.token:
            raise ValueError('Invalid token file')
        STATE.mkdir(mode=0o700, exist_ok=True)

    def call(self, method, **params):
        req = urllib.request.Request(
            'https://tapi.bale.ai/bot' + self.token + '/' + method,
            data=json.dumps(params).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f'Bale HTTP failure; status={exc.code}; no automatic retry of writes') from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError('Network/HTTP failure; no automatic retry of writes') from None
        if not payload.get('ok'):
            raise RuntimeError('Bale API rejected request; error_code=' + str(payload.get('error_code'))) from None
        result = payload.get('result')
        evidence = {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'method': method, 'result': shape(result)}
        with (STATE / 'evidence.jsonl').open('a') as output:
            output.write(json.dumps(evidence, ensure_ascii=False) + '\n')
        return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    start = sub.add_parser('start')
    start.add_argument('--channel', required=True)
    sub.add_parser('poll')
    reply = sub.add_parser('reply')
    reply.add_argument('--chat', required=True)
    reply.add_argument('--message', type=int, required=True)
    reply.add_argument('--thread', type=int)
    channel_reply = sub.add_parser('channel-reply')
    channel_reply.add_argument('--post', type=int, choices=[1, 2], required=True)
    edit = sub.add_parser('edit')
    edit.add_argument('--post', type=int, choices=[1, 2], required=True)
    args = parser.parse_args()
    api = API()
    config_path = STATE / 'posts.json'
    if args.action == 'start':
        if config_path.exists():
            raise RuntimeError('Existing probe posts; use edit/poll instead of creating duplicates')
        api.call('getMe')
        info = api.call('getWebhookInfo')
        if info.get('url'):
            raise RuntimeError('Webhook is active. Use a dedicated test bot; probe will not remove webhook')
        chat = api.call('getChat', chat_id=args.channel)
        config = {'channel': chat['id'], 'linked_chat_id': chat.get('linked_chat_id'), 'posts': []}
        config_path.write_text(json.dumps(config))
        for index in (1, 2):
            post = api.call('sendMessage', chat_id=chat['id'],
                            text=f'#باگ\nآزمون فاز صفر {index}\nلطفاً دیدگاه اختصاصی این پست را بررسی کنید.')
            config['posts'].append(post['message_id'])
            config_path.write_text(json.dumps(config))
        print(json.dumps(config))
    elif args.action == 'poll':
        info = api.call('getWebhookInfo')
        if info.get('url'):
            raise RuntimeError('Webhook active; polling refused')
        cursor = STATE / 'offset'
        offset = int(cursor.read_text()) if cursor.exists() else 0
        updates = api.call('getUpdates', offset=offset, limit=100, timeout=20)
        # Persist routing evidence before acknowledging updates on the next invocation.
        if updates:
            cursor.write_text(str(max(x['update_id'] for x in updates) + 1))
        print(json.dumps(shape(updates), ensure_ascii=False, indent=2))
    elif args.action == 'channel-reply':
        config = json.loads(config_path.read_text())
        result = api.call('sendMessage', chat_id=config['channel'],
                          reply_to_message_id=config['posts'][args.post - 1],
                          text=f'آزمون پاسخ مستقیم بات به پست {args.post} کانال؛ محل نمایش باید بررسی شود.')
        print(json.dumps(shape(result), ensure_ascii=False))
    elif args.action == 'reply':
        config = json.loads(config_path.read_text())
        if str(config.get('linked_chat_id')) != args.chat:
            raise RuntimeError('Reply target must match linked_chat_id from getChat')
        params = {'chat_id': args.chat, 'reply_to_message_id': args.message,
                  'text': 'پاسخ آزمایشی بات در دیدگاه همین پست؛ لطفاً محل نمایش را بررسی کنید.'}
        if args.thread is not None:
            params['message_thread_id'] = args.thread
        print(json.dumps(shape(api.call('sendMessage', **params)), ensure_ascii=False))
    else:
        config = json.loads(config_path.read_text())
        print(json.dumps(shape(api.call('editMessageText', chat_id=config['channel'],
              message_id=config['posts'][args.post - 1],
              text=f'#بهبود\nآزمون فاز صفر {args.post} — ویرایش شد\nوضعیت: بسته‌شده؛ دیدگاه‌ها باید حفظ شوند.')), ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, KeyError, IndexError) as exc:
        # Avoid tracebacks containing request URLs or credentials.
        print('Probe stopped: ' + (str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__), file=sys.stderr)
        sys.exit(1)
