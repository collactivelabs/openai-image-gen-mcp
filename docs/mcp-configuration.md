# MCP Configuration Guide

This document provides detailed instructions on how to configure the OpenAI Image Generation MCP for use with Claude and other LLM systems.

## What is MCP?

MCP (Model Calling Protocol) is a protocol for Large Language Models (LLMs) to call other models or services. It enables LLMs like Claude to delegate specific tasks to specialized models, such as image generation, when needed.

## Configuring Claude to use this MCP

To allow Claude to generate images using this MCP, you'll need to register the MCP with Claude. This can be done in two ways:

### Option 1: Using Claude API

When making API requests to Claude, include the MCP configuration in your request:

```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Please generate an image of a sunset over mountains"
    }
  ],
  "tools": [
    {
      "name": "openai_image_generation",
      "mcp": {
        "url": "https://your-server-url.com/mcp",
        "auth": {
          "type": "bearer",
          "token": "your_authentication_token" // If you've implemented authentication
        }
      }
    }
  ]
}
```

### Option 2: Using Claude Console

If you're using the Claude Console, you can configure MCPs in the Developer Settings:

1. Go to Developer Settings
2. Navigate to the MCPs section
3. Click "Add MCP"
4. Fill in the details:
   - Name: `openai_image_generation`
   - URL: `https://your-server-url.com/mcp`
   - Authentication (if implemented): Select Bearer Token and enter your token

## Sample MCP JSON Configuration

```json
{
  "name": "openai_image_generation",
  "description": "Generate images using OpenAI's DALL-E models",
  "mcp_url": "https://your-server-url.com/mcp",
  "authentication": {
    "type": "bearer",
    "token": "your_auth_token"
  },
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "A detailed text description of the image you want to generate"
      },
      "model": {
        "type": "string",
        "enum": ["dall-e-2", "dall-e-3"],
        "description": "The DALL-E model to use for generation",
        "default": "dall-e-3"
      },
      "size": {
        "type": "string",
        "enum": ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
        "description": "The size of the generated image",
        "default": "1024x1024"
      },
      "quality": {
        "type": "string",
        "enum": ["standard", "hd"],
        "description": "The quality of the generated image",
        "default": "standard"
      },
      "style": {
        "type": "string",
        "enum": ["vivid", "natural"],
        "description": "The style of the generated image",
        "default": "vivid"
      },
      "n": {
        "type": "integer",
        "description": "The number of images to generate",
        "default": 1,
        "minimum": 1,
        "maximum": 10
      },
      "save": {
        "type": "boolean",
        "description": "Whether to save the generated image to the filesystem",
        "default": true
      }
    },
    "required": ["prompt"]
  }
}
```

## Implementing Authentication (Optional)

For production deployments, it's recommended to add authentication to your MCP server. This example uses a simple bearer token:

1. Add an environment variable for your token:
   ```
   MCP_AUTH_TOKEN=your_secret_token_here
   ```

2. Update your server code to check for this token:
   ```javascript
   // Authentication middleware
   app.use('/mcp', (req, res, next) => {
     const authHeader = req.headers.authorization;
     
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return res.status(401).json({ 
         success: false, 
         error: 'Missing or invalid authorization header' 
       });
     }
     
     const token = authHeader.split(' ')[1];
     
     if (token !== process.env.MCP_AUTH_TOKEN) {
       return res.status(403).json({ 
         success: false, 
         error: 'Invalid authentication token' 
       });
     }
     
     next();
   });
   ```

## Testing Claude with the MCP

Once your MCP is configured and Claude has access to it, you can test it with prompts like:

1. "Generate an image of a sunset over mountains"
2. "Create a picture of a futuristic city with flying cars"
3. "Make an illustration of a friendly robot playing with children"

Claude should recognize these as image generation requests and use your MCP to generate the images.