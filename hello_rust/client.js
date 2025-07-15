// client.js

// Mock the 'vscode' module, which is required by the language client library
const vscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key, defaultValue) => defaultValue
    })
  },
};
require.cache.vscode = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: vscode
};

const path = require('path');
const fs = require('fs');
const net = require('net');
const {
  LanguageClient,
  StreamInfo
} = require('vscode-languageclient/node');

const PORT = 6010; // The port to connect to

// --- 1. Define Server Options for TCP connection ---
const serverOptions = () => {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, '127.0.0.1', () => {
      console.log('Client connected to TCP server.');
      resolve({
        reader: socket,
        writer: socket
      });
    });
    socket.on('error', (err) => reject(err));
  });
};

// --- 2. Define Client Options ---
// Tell the client to handle files with the 'rust' language ID.
// We also set the rootUri to the current directory so rust-analyzer
// knows where our Cargo.toml is.
const clientOptions = {
  documentSelector: [{
    scheme: 'file',
    language: 'rust'
  }],
  uriConverters: {
    // VS Code by default uses a different URI encoding than what is produced by
    // `path.join` and `file://`. We can override this to ensure compatibility.
    code2Protocol: uri => uri.toString().replace('%3A', ':'),
    protocol2Code: str => vscode.Uri.parse(str)
  },
  // This is crucial for rust-analyzer to find Cargo.toml
  workspaceFolder: {
    uri: 'file://' + process.cwd(),
    name: 'rust_lsp_test',
    index: 0
  }
};

// --- 3. Create and Start the Language Client ---
console.log('Creating Language Client...');
const client = new LanguageClient(
  'rustClient',
  'Rust Language Client',
  serverOptions,
  clientOptions
);

console.log('Starting client...');
client.start();

// --- 4. Send the File for Analysis ---
client.onReady().then(() => {
  console.log('Client is ready. Sending file for analysis...');

  // Define the file we want to analyze.
  const filePath = path.join(process.cwd(), 'src', 'main.rs');
  const fileUri = 'file://' + filePath;
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  // Send the 'textDocument/didOpen' notification
  client.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: fileUri,
      languageId: 'rust',
      version: 1,
      text: fileContent,
    },
  });

  console.log(`Sent 'didOpen' notification for: ${filePath}`);
});

// --- 5. Listen for Diagnostics from the Server ---
client.onNotification('textDocument/publishDiagnostics', (params) => {
  console.log('\n--- Diagnostics Received ---');
  console.log(`File: ${path.basename(params.uri)}`);

  if (params.diagnostics.length === 0) {
    console.log('No issues found.');
  } else {
    params.diagnostics.forEach(diagnostic => {
      console.log(
        `  - [Line ${diagnostic.range.start.line + 1}] ${diagnostic.message} (Source: ${diagnostic.source})`
      );
    });
  }
  console.log('--------------------------\n');

  // Stop the client after receiving diagnostics.
  client.stop();
});
