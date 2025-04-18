from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import sys

class MyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        query_params = parse_qs(parsed_url.query)
        
        if 'l' in query_params:
            l_value = query_params['l'][0]
            self.send_response(302)
            self.send_header('Location', l_value)
            self.end_headers()
        else:
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(bytes("need l query parameter as http://127.0.0.1:10114/v1?l=XXX\n", "utf-8"))

def main():
    try:
        server_address = ('127.0.0.1', 10114)
        httpd = HTTPServer(server_address, MyHandler)
        print('Starting server on {}:{}'.format(server_address[0], server_address[1]))
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopping server...')
        httpd.socket.close()

if __name__ == '__main__':
    main()

# 实现端口的监听，时间将URL scheme转换为http开头的URL