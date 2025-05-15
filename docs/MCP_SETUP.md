# MCP Server Setup Instructions

## The Problem

The original implementation was built as an HTTP REST API server, but Claude expects an MCP server that communicates via JSON-RPC over stdin/stdout. This is why you were seeing the "Server transport closed unexpectedly" error.

## The Solution

I've created a proper MCP server implementation (`src/mcp-server.js`) that:
1. Communicates via stdin/stdout as MCP requires
2. Implements the MCP protocol with JSON-RPC
3. Handles the required MCP methods: `initialize`, `tools/list`, and `tools/call`
4. Uses absolute paths for the generated-images directory to avoid permission issues

## How to Configure

### Method 1: Using Claude Desktop App

1. Find your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add this configuration:

```json
{
  "mcpServers": {
    "openai-image-generation": {
      "command": "node",
      "args": ["src/mcp-server.js"],
      "cwd": "/Users/englarmerdgemongwe/My-Projects/openai-image-gen-mcp",
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key-here"
      }
    }
  }
}
```

3. Replace `your-openai-api-key-here` with your actual OpenAI API key

4. Restart Claude Desktop

### Method 2: Using Environment Variables

If you prefer to use a `.env` file:

1. Create a `.env` file in the project root:
```
OPENAI_API_KEY=your-openai-api-key-here
```

2. Update the Claude configuration without the API key in env:

```json
{
  "mcpServers": {
    "openai-image-generation": {
      "command": "node",
      "args": ["src/mcp-server.js"],
      "cwd": "/Users/englarmerdgemongwe/My-Projects/openai-image-gen-mcp"
    }
  }
}
```

## Directory Permissions Issue (Fixed)

The MCP server now uses `__dirname` to determine the project directory instead of `process.cwd()`, which prevents the directory creation errors. It will:

1. Try to create `generated-images` in the project directory
2. If that fails, it will fall back to `~/.openai-image-gen-mcp/generated-images`
3. Log where images are being saved

## Testing the MCP Server

You can test the MCP server manually:

1. Run the server directly:
```bash
cd /Users/englarmerdgemongwe/My-Projects/openai-image-gen-mcp
node src/mcp-server.js
```

2. Send a test initialization message:
```json
{"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"jsonrpc":"2.0","id":1}
```

You should see a response with server info.

## Using with Claude

Once configured, you can ask Claude to generate images:
- "Generate an image of a sunset over mountains"
- "Create a picture of a futuristic city"
- "Make an illustration of a robot"

Claude will use the MCP server to generate these images using DALL-E.

## Troubleshooting

1. **Check logs**: Look at stderr output (it will appear in Claude's logs) for error messages
2. **Verify API key**: Ensure your OpenAI API key is valid
3. **Check file paths**: Make sure the `cwd` path in the configuration is correct
4. **Directory permissions**: The server will log where it's trying to save images
5. **Dependencies**: Make sure you have the required Node.js dependencies installed:
   ```bash
   cd /Users/englarmerdgemongwe/My-Projects/openai-image-gen-mcp
   npm install
   ```

## Common Errors and Solutions

### "ENOENT: no such file or directory, mkdir '/generated-images'"
**Solution**: This is fixed in the updated server. It now uses absolute paths based on the script location.

### "Server transport closed unexpectedly"
**Solution**: Make sure you're using the MCP server (`src/mcp-server.js`), not the HTTP server.

### "Invalid authentication token"
**Solution**: Check that your OpenAI API key is correctly set in the configuration.

## The Old HTTP Server

The original HTTP server (`src/index.js`) is still available if you need it for other integrations. You can run it with:
```bash
npm run start:http
```

This serves as a regular REST API at `http://localhost:3000`.
