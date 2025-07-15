// client.js

// --- 0. Mock the 'vscode' module ---
// This MUST be at the very top of the file, before any other require()
// statements that might depend on it.
// The 'vscode-languageclient' library expects to be run in a VS Code
// extension context, where a 'vscode' module is available.
// To run it as a standalone Node.js script, we need to provide a
// minimal mock to prevent a "Cannot find module 'vscode'" error.
const vscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key, defaultValue) => defaultValue,
    }),
    // Add other properties if needed by the language client
  },
  // Add other top-level vscode APIs if needed
};

// We inject the mock into Node's require cache. This is a clean way
// to make the mock available to any module that requires 'vscode'.
require.cache.vscode = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: vscode,
};


// Now we can safely require the other modules.
const path = require('path');
const fs = require('fs');
const net = require('net');
const {
  LanguageClient,
  StreamInfo
} = require('vscode-languageclient/node');


const PORT = 6009; // The port to connect to

// --- 1. Define Server Options (for TCP connection) ---
// Instead of a command, we provide a function that returns a Promise<StreamInfo>.
// This function will be called by the client to establish the connection.
const serverOptions = () => {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, '127.0.0.1', () => {
      console.log('Client connected to TCP server.');
      // The StreamInfo object contains the read and write streams.
      resolve({
        reader: socket,
        writer: socket
      });
    });
    socket.on('error', (err) => reject(err));
  });
};

// --- 2. Define Client Options ---
// This remains the same. It tells the client which documents it's responsible for.
const clientOptions = {
  documentSelector: [{
    scheme: 'file',
    language: 'markdown'
  }],
};

// --- 3. Create and Start the Language Client ---
console.log('Creating Language Client...');
const client = new LanguageClient(
  'unifiedClient',
  'Unified Language Client',
  serverOptions,
  clientOptions
);

console.log('Starting client...');
// This will now attempt to connect to the TCP server instead of launching a process.
client.start();


// --- 4. Send the File for Analysis ---
// This logic remains the same.
client.onReady().then(() => {
  console.log('Client is ready. Sending file for analysis...');

  const filePath = path.join(__dirname, 'sample.md');
  const fileUri = 'file://' + filePath;
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  client.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: fileUri,
      languageId: 'markdown',
      version: 1,
      text: fileContent,
    },
  });

  console.log(`Sent 'didOpen' notification for: ${filePath}`);
});


// --- 5. Listen for Diagnostics from the Server ---
// This logic also remains the same.
client.onNotification('textDocument/publishDiagnostics', (params) => {
  console.log('\n--- Diagnostics Received ---');
  console.log(`File: ${params.uri}`);

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
  // This will close the socket connection.
  client.stop();
});
