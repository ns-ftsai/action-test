import json
import socket
import time
import os

class LSPClient:
    def __init__(self, host="127.0.0.1", port=2087):
        self.host = host
        self.port = port
        self.request_id = 0
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((self.host, self.port))
    
    def send_request(self, method, params=None):
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {}
        }
        
        content = json.dumps(request)
        message = f"Content-Length: {len(content)}\r\n\r\n{content}"
        
        self.sock.send(message.encode())
        
        # Read response
        response_data = b""
        while True:
            chunk = self.sock.recv(1024)
            if not chunk:
                break
            response_data += chunk
            if b"\r\n\r\n" in response_data:
                break
        
        return response_data.decode()
    
    def send_notification(self, method, params=None):
        request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {}
        }
        
        content = json.dumps(request)
        message = f"Content-Length: {len(content)}\r\n\r\n{content}"
        
        self.sock.send(message.encode())

# Initialize client
client = LSPClient()

# 1. Initialize
init_params = {
    "processId": None,
    "rootUri": os.getcwd(),
    "capabilities": {}
}

print("Initializing...")
print(client.send_request("initialize", init_params))

# 2. Initialized notification
print("Sending initialized notification...")
client.send_notification("initialized", {})

# 3. Open document
file_uri = os.path.join(os.getcwd(), "print.py")
with open(file_uri, "r") as f:
    file_content = f.read()

open_params = {
    "textDocument": {
        "uri": file_uri,
        "languageId": "python",
        "version": 1,
        "text": file_content
    }
}
print("Opening document...")
client.send_notification("textDocument/didOpen", open_params)

# 4. Go to definition
def_params = {
    "textDocument": {"uri": file_uri},
    "position": {"line": 6, "character": 1}
}
print("Getting definition...")
print(client.send_request("textDocument/definition", def_params))