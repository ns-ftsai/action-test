import json
import socket
import time

class LSPClient:
    def __init__(self, host="127.0.0.1", port=2087):
        self.host = host
        self.port = port
        self.request_id = 0
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((self.host, self.port))
        
    def read_response(self):
        # Read headers
        header = b""
        while b"\r\n\r\n" not in header:
            header += self.sock.recv(1)

        headers = {}
        for line in header.decode().split("\r\n"):
            if line.startswith("Content-Length:"):
                content_length = int(line.split(":")[1].strip())

        # Read body
        body = b""
        while len(body) < content_length:
            body += self.sock.recv(content_length - len(body))

        return body.decode()
    
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

        # Now read messages until we find the matching id
        while True:
            response = self.read_response()
            parsed = json.loads(response)
            if parsed.get("id") == self.request_id:
                return parsed
            else:
                print("🔔 Notification or unrelated message:", parsed)
    
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
    "rootUri": "file:///Users/justinl/Desktop/language-server-test",
    "capabilities": {
        "textDocument": {
            "definition": {
                "linkSupport": True
            }
        }
    }
}

print("Initializing...")
print(client.send_request("initialize", init_params))

# 2. Initialized notification
print("Sending initialized notification...")
client.send_notification("initialized", {})

# 3. Open document
file_uri = "file:///Users/justinl/Desktop/language-server-test/test_definition_search.py" # change here
with open("/Users/justinl/Desktop/language-server-test/test_definition_search.py", "r") as f: # change here .go
    file_content = f.read()

open_params = {
    "textDocument": {
        "uri": file_uri,
        "languageId": "python", # change here
        "version": 1,
        "text": file_content
    }
}
print("Opening document...")
client.send_notification("textDocument/didOpen", open_params)

# time.sleep(10)

# 4. Go to definition
def_params = {
    "textDocument": {"uri": file_uri},
    "position": {"line": 31, "character": 13} # change here, line and char
}
print("Getting definition...")
print(client.send_request("textDocument/definition", def_params))

# Wait a bit to keep connection alive
# time.sleep(5)