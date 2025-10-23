# OpenAI Image Generation MCP

An MCP (Model Context Protocol) service that allows Claude to generate images using OpenAI's DALL-E models.

> **Important**: This project includes two different implementations:
> 1. **MCP Server** (`src/mcp-server.js`) - For direct integration with Claude Desktop via stdin/stdout
> 2. **HTTP REST API** (`src/index.js`) - For HTTP-based integrations
> 
> If you're trying to use this with Claude Desktop, you need the MCP server. See [MCP_SETUP.md](MCP_SETUP.md) for setup instructions.

## Overview

This service implements the Model Context Protocol to enable Claude to generate images by calling OpenAI's DALL-E image generation models. When Claude needs to generate an image based on a user's request, it can use this MCP to:

1. Send a prompt to OpenAI's DALL-E
2. Receive back generated image URLs
3. Save generated images locally for reference
4. Return the images to Claude for use in the conversation

## Features

- **Image Generation:** DALL-E 2 and DALL-E 3 support with full parameter control
- **Dual Interface:** MCP server for Claude Desktop + HTTP REST API
- **Security:** Bearer token authentication, rate limiting, input validation
- **Image Management:** Automatic cleanup with configurable retention policies
- **Monitoring:** Prometheus-compatible metrics and admin endpoints
- **Production Ready:** Comprehensive error handling, logging, and testing
- **Developer Friendly:** OpenAPI/Swagger docs, detailed examples

## Prerequisites

- Node.js (v14 or higher)
- An OpenAI API key with access to DALL-E models

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/openai-image-gen-mcp.git
   cd openai-image-gen-mcp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Usage Options

### Option 1: MCP Server for Claude Desktop

This is the correct mode for Claude Desktop integration. The MCP server communicates via stdin/stdout using JSON-RPC.

**Configuration for Claude Desktop:**

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
      "args": ["/full/path/to/openai-image-gen-mcp/src/mcp-server.js"],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key-here"
      }
    }
  }
}
```

3. Restart Claude Desktop

**Testing the MCP Server:**

```bash
node src/mcp-server.js
```

Then send a test message:
```json
{"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"jsonrpc":"2.0","id":1}
```

### Option 2: HTTP REST API Server

The HTTP server is available for other integrations that need a REST API.

**Starting the HTTP Server:**

```bash
npm run start:http
# or
node src/index.js
```

The server will start on port 3000 (or the port specified in `.env`).

**Endpoints:**

- `GET /health`: Health check endpoint
- `GET /mcp`: Returns the MCP interface description
- `POST /mcp`: Executes the image generation with the provided parameters
- `GET /images/:filename`: Serves generated images

**Example Request:**

```json
{
  "prompt": "A serene mountain landscape with a lake at sunset",
  "model": "dall-e-3",
  "size": "1024x1024",
  "style": "natural",
  "save": true
}
```

## Available Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| prompt | string | A text description of the image to generate | Required |
| model | string | The DALL-E model to use: "dall-e-2" or "dall-e-3" | "dall-e-3" |
| size | string | Image size: "256x256", "512x512", "1024x1024", "1792x1024", or "1024x1792" | "1024x1024" |
| quality | string | Image quality: "standard" or "hd" | "standard" |
| style | string | Image style: "vivid" or "natural" | "vivid" |
| n | integer | Number of images to generate (1-10) | 1 |

## Project Structure

- `src/mcp-server.js`: MCP server implementation (for Claude Desktop)
- `src/index.js`: HTTP REST API server
- `src/openai-image-gen.js`: OpenAI image generation implementation
- `src/middleware/`: Express middleware (auth, rate limiting)
- `src/utils/`: Utilities (validation, config, logging, metrics, cleanup)
- `tests/`: Comprehensive test suites (80+ tests)
- `docs/`: Documentation including OpenAPI spec
- `generated-images/`: Directory where generated images are saved

## API Documentation

Full API documentation is available in OpenAPI/Swagger format:
- **OpenAPI Spec:** [docs/openapi.yaml](docs/openapi.yaml)
- **Interactive Docs:** Import the spec into [Swagger Editor](https://editor.swagger.io/)

## Monitoring & Administration

### Metrics Endpoints
- `GET /metrics` - Prometheus-compatible metrics (public)
- `GET /admin/metrics` - Detailed JSON metrics (requires auth)

### Admin Endpoints (require authentication)
- `GET /admin/images/stats` - View image statistics
- `POST /admin/images/cleanup` - Manually trigger cleanup

### Available Metrics
- HTTP request/response tracking
- Image generation success/failure rates
- Response times (p50, p95, p99)
- System metrics (memory, uptime)
- Rate limiting status

## Troubleshooting

If you're getting "Server transport closed unexpectedly" errors with Claude Desktop:

1. Make sure you're using the MCP server (`src/mcp-server.js`), not the HTTP server
2. Check that your Claude Desktop configuration points to the correct file
3. Ensure your OpenAI API key is valid
4. Look for error messages in Claude's logs

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
