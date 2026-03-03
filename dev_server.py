#!/usr/bin/env python3
"""
Simple dev server that serves static files and falls back to product.html
for unknown paths (useful for SPA-style clean URLs like /green-paws-cats...).

Usage: python dev_server.py [port]
"""
import http.server
import socketserver
import sys
import os
from urllib.parse import unquote, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
FALLBACK = 'product.html'

class FallbackHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Use default translation to a filesystem path
        path = urlparse(path).path
        path = unquote(path)
        return super().translate_path(path)

    def send_error(self, code, message=None):
        if code == 404:
            # Serve fallback file instead of 404
            fallback_path = os.path.join(ROOT, FALLBACK)
            if os.path.exists(fallback_path):
                try:
                    with open(fallback_path, 'rb') as fh:
                        self.send_response(200)
                        self.send_header('Content-type', 'text/html; charset=utf-8')
                        fs = os.fstat(fh.fileno())
                        self.send_header('Content-Length', str(fs.st_size))
                        self.end_headers()
                        self.copyfile(fh, self.wfile)
                        return
                except Exception:
                    pass
        # fallback to default behavior
        super().send_error(code, message)

    def log_message(self, format, *args):
        # keep logs concise
        sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format%args))

if __name__ == '__main__':
    os.chdir(ROOT)
    handler = FallbackHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving at http://localhost:{PORT} (fallback -> {FALLBACK})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down')
            httpd.server_close()
