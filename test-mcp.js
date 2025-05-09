#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Test cases for MCP protocol
const testCases = [
  {
    name: 'Initialize',
    request: {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '0.1.0'
        }
      }
    }
  },
  {
    name: 'Tools List',
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: 'Resources List',
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/list',
      params: {}
    }
  }
];

// Spawn the MCP server
const serverPath = path.join(__dirname, 'src', 'mcp-server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
  }
});

// Store responses
const responses = [];

// Read output from server
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.error('Failed to parse response:', line);
      }
    }
  }
});

// Log server errors
server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Send test cases
let currentTest = 0;

function sendNextTest() {
  if (currentTest < testCases.length) {
    const test = testCases[currentTest];
    console.log(`\n--- Test: ${test.name} ---`);
    console.log('Request:', JSON.stringify(test.request, null, 2));
    server.stdin.write(JSON.stringify(test.request) + '\n');
    currentTest++;
    setTimeout(sendNextTest, 1000);
  } else {
    // All tests sent, wait a bit then exit
    setTimeout(() => {
      console.log('\n--- Test Complete ---');
      console.log(`Received ${responses.length} responses`);
      server.kill();
      process.exit(0);
    }, 2000);
  }
}

// Start tests
console.log('Starting MCP server tests...');
setTimeout(sendNextTest, 1000);

// Handle server exit
server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  if (code !== 0) {
    process.exit(1);
  }
});
