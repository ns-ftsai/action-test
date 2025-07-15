// server-wrapper.js
const net = require('net');
const {
  spawn
} = require('child_process');

const PORT = 2089; // A different port for the Rust server

// The command for rust-analyzer. It runs on stdio by default.
const serverCommand = 'rust-analyzer';

// Create a TCP server
const server = net.createServer((socket) => {
  console.log('Rust LSP client connected.');

  // When a client connects, spawn the rust-analyzer process
  const lspProcess = spawn(serverCommand, [], {
    // It's important to run this from the project's root directory
    cwd: process.cwd()
  });
  console.log(`Spawned rust-analyzer with PID: ${lspProcess.pid}`);

  // Pipe the communication between the socket and the LSP process
  socket.pipe(lspProcess.stdin);
  lspProcess.stdout.pipe(socket);

  // Handle errors and closing
  lspProcess.stderr.on('data', (data) => {
    console.error(`rust-analyzer stderr: ${data}`);
  });

  lspProcess.on('exit', (code) => {
    console.log(`rust-analyzer process exited with code ${code}`);
  });

  socket.on('close', () => {
    console.log('Client disconnected.');
    lspProcess.kill();
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
    lspProcess.kill();
  });
});

// Start listening for connections
server.listen(PORT, '127.0.0.1', () => {
  console.log(`TCP Server Wrapper listening for rust-analyzer clients on port ${PORT}`);
  console.log('Start this server, then run the client in another terminal.');
});
