"""Read-only diagnostic for inconsistent Bale 32-bit / 52-bit chat IDs."""
import json
from bale_probe import API, shape

if __name__ == '__main__':
    api = API()
    # editMessageText returned 62508476 for channel 4357475772: exactly 2**32 apart.
    for label, chat_id in [('channel_original', 4357475772), ('channel_low32', 62508476),
                           ('comments_original', 4961157767), ('comments_low32', 666190471)]:
        try:
            result = api.call('getChat', chat_id=chat_id)
            print(json.dumps({'case': label, 'requested_chat_id': chat_id, 'result': shape(result)}, ensure_ascii=False))
        except RuntimeError as error:
            print(json.dumps({'case': label, 'error': str(error)}))
