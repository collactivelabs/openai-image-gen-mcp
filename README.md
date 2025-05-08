# OpenAI Image Generation MCP

An MCP (Model Calling Protocol) service that allows Claude to generate images using OpenAI's DALL-E models.

## Overview

This service implements the Model Calling Protocol to enable Claude to generate images by calling OpenAI's DALL-E image generation models. When Claude needs to generate an image based on a user's request, it can use this MCP to:

1. Send a prompt to OpenAI's DALL-E
2. Receive back generated image URLs or base64-encoded images
3. Save generated images locally for reference
4. Return the images to Claude for use in the conversation

## Features

- Generate images with DALL-E 2 or DALL-E 3
- Configure image size, quality, and style
- Generate multiple images at once
- Save generated images locally
- Serve generated images via HTTP

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
   PORT=3000  # Optional, defaults to 3000
   ```

## Usage

### Starting the Server

Run the server:

```
npm start
```

The server will start on the port specified in your `.env` file (defaults to 3000).

### MCP Endpoints

The server exposes the following endpoints:

- `GET /health`: Health check endpoint
- `GET /mcp`: Returns the MCP interface description
- `POST /mcp`: Executes the image generation with the provided parameters
- `GET /images/:filename`: Serves generated images

### API Parameters

When calling the `POST /mcp` endpoint, the following parameters are available:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| prompt | string | A text description of the image to generate | Required |
| model | string | The DALL-E model to use: "dall-e-2" or "dall-e-3" | "dall-e-3" |
| size | string | Image size: "256x256", "512x512", "1024x1024", "1792x1024", or "1024x1792" | "1024x1024" |
| quality | string | Image quality: "standard" or "hd" | "standard" |
| style | string | Image style: "vivid" or "natural" | "vivid" |
| n | integer | Number of images to generate (1-10) | 1 |
| save | boolean | Whether to save the image locally | true |

### Example Request

```json
{
  "prompt": "A serene mountain landscape with a lake at sunset",
  "model": "dall-e-3",
  "size": "1024x1024",
  "style": "natural",
  "save": true
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "url": "https://oaidalleapiprodscus.blob.core.windows.net/private/...",
    "revised_prompt": "A serene mountain landscape with a crystal-clear lake reflecting the orange and pink hues of the sunset. The mountains are partially covered with snow at their peaks, with pine trees dotting the lower slopes. The sky is painted with vibrant sunset colors, casting a warm glow over the entire scene.",
    "filePath": "/path/to/generated-images/image_1234567890.png",
    "imageUrl": "http://localhost:3000/images/image_1234567890.png"
  }
}
```

## MCP Integration with Claude

Configure this MCP server in the Claude API or Console to allow Claude to generate images during conversations.

Example configuration:
```json
{
  "tools": [
    {
      "name": "openai_image_generation",
      "mcp_url": "http://your-server-address:3000/mcp"
    }
  ]
}
```

## Development

### Project Structure

- `src/index.js`: Main server file
- `src/openai-image-gen.js`: OpenAI image generation implementation
- `generated-images/`: Directory where generated images are saved

### Adding New Features

To add new features or modify the existing functionality:

1. Update the `OpenAIImageGenMCP` class in `src/openai-image-gen.js`
2. Ensure the MCP interface is updated in the `getMCPInterface()` method
3. Test your changes by making requests to the `/mcp` endpoint

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.