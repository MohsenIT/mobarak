"""Serve static installer assets with the same route fallback as the native shell."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
root = Path(sys.argv[1]).resolve()
class Reader(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def do_GET(self):
        route = self.path.split('?', 1)[0]
        if route.startswith(('/s/', '/p/')) and not (root / route.lstrip('/')).is_file():
            self.path = '/index.html'
        super().do_GET()
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), Reader).serve_forever()
