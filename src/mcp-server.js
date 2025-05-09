#!/usr/bin/env node

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
try {
  require('dotenv').config();
} catch (error) {
  // Continue without dotenv
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure output directory exists
const scriptDir = __dirname;
let outputDir = path.join(scriptDir, '..', 'generated-images');

// Log function that writes to stderr
function log(message) {
  console.error(`[${new Date().toISOString()}] ${message}`);
}

log(`Using output directory: ${outputDir}`);

try {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    log(`Created output directory: ${outputDir}`);
  }
} catch (error) {
  log(`Failed to create output directory: ${error.message}`);
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const fallbackDir = path.join(homeDir, '.openai-image-gen-mcp', 'generated-images');
  try {
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    log(`Using fallback directory: ${fallbackDir}`);
    outputDir = fallbackDir;
  } catch (fallbackError) {
    log(`Failed to create fallback directory: ${fallbackError.message}`);
  }
}

// Download and save image
async function saveImage(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(outputDir, filename);
    const file = fs.createWriteStream(fullPath);
    
    https.get(imageUrl, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        log(`Image saved to ${fullPath}`);
        resolve(fullPath);
      });
    }).on('error', (err) => {
      log(`Error downloading image: ${err.message}`);
      fs.unlink(fullPath, () => {});
      reject(err);
    });
  });
}

// Generate image using OpenAI
async function generateImage(prompt, options = {}) {
  try {
    const params = {
      model: options.model || 'dall-e-3',
      prompt: prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard',
      style: options.style || 'vivid',
      response_format: 'url'
    };
    
    log(`Generating image with prompt: "${prompt.substring(0, 50)}..."`);
    const response = await openai.images.generate(params);
    log(`Image generated successfully`);
    
    return response.data;
  } catch (error) {
    log(`Error generating image: ${error.message}`);
    throw error;
  }
}

// MCP Server Implementation
class MCPServer {
  constructor() {
    this.buffer = '';
    this.initialized = false;
  }

  async handleRequest(request) {
    try {
      const { method, params, id, jsonrpc } = request;
      
      // Validate JSON-RPC version
      if (jsonrpc !== '2.0') {
        return {
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'jsonrpc must be "2.0"'
          }
        };
      }
      
      switch (method) {
        case 'initialize':
          this.initialized = true;
          
          // Send the response
          const initResponse = {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'openai-image-generation',
                version: '1.0.0'
              }
            }
          };
          
          // Process the response synchronously
          process.stdout.write(JSON.stringify(initResponse) + '\n');
          
          // Send initialized notification after the response
          setTimeout(() => {
            if (this.initialized) {
              const notification = {
                jsonrpc: '2.0',
                method: 'notifications/initialized'
              };
              process.stdout.write(JSON.stringify(notification) + '\n');
            }
          }, 100);
          
          return null; // Already sent
          
        case 'notifications/initialized':
          // This is a notification from client, no response needed
          return null;
          
        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'generate_image',
                  description: 'Generate an image using OpenAI DALL-E',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      prompt: {
                        type: 'string',
                        description: 'Text description of the image to generate'
                      },
                      model: {
                        type: 'string',
                        enum: ['dall-e-2', 'dall-e-3'],
                        description: 'Model to use',
                        default: 'dall-e-3'
                      },
                      size: {
                        type: 'string',
                        enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
                        description: 'Image size',
                        default: '1024x1024'
                      },
                      quality: {
                        type: 'string',
                        enum: ['standard', 'hd'],
                        description: 'Image quality',
                        default: 'standard'
                      },
                      style: {
                        type: 'string',
                        enum: ['vivid', 'natural'],
                        description: 'Image style',
                        default: 'vivid'
                      },
                      n: {
                        type: 'integer',
                        description: 'Number of images',
                        default: 1,
                        minimum: 1,
                        maximum: 10
                      }
                    },
                    required: ['prompt']
                  }
                }
              ]
            }
          };
          
        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              resources: []
            }
          };
          
        case 'prompts/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              prompts: []
            }
          };
          
        case 'tools/call':
          const { name, arguments: args } = params;
          
          if (name === 'generate_image') {
            try {
              const images = await generateImage(args.prompt, args);
              
              if (images.length > 0 && images[0].url) {
                let responseText = `Image generated successfully!\n\nPrompt: ${args.prompt}`;
                
                const filename = `image_${Date.now()}.png`;
                if (args.save !== false) {
                  try {
                    const filePath = await saveImage(images[0].url, filename);
                    responseText += `\n\nSaved to: ${filePath}`;
                  } catch (saveError) {
                    log(`Failed to save image: ${saveError.message}`);
                    responseText += `\n\nNote: Failed to save image locally, but it was generated successfully.`;
                  }
                }
                
                responseText += `\n\nImage URL: ${images[0].url}`;
                
                if (images[0].revised_prompt) {
                  responseText += `\n\nRevised prompt: ${images[0].revised_prompt}`;
                }
                
                return {
                  jsonrpc: '2.0',
                  id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: responseText
                      }
                    ]
                  }
                };
              } else {
                throw new Error('No image was generated');
              }
            } catch (error) {
              log(`Error in generate_image: ${error.message}`);
              return {
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32000,
                  message: `Failed to generate image: ${error.message}`
                }
              };
            }
          }
          
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
          
        default:
          // For unknown methods, return method not found
          if (id !== undefined) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: 'Method not found'
              }
            };
          }
          // If no id, it's a notification, no response needed
          return null;
      }
    } catch (error) {
      log(`Error handling request: ${error.message}`);
      return {
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      };
    }
  }

  processInput(chunk) {
    this.buffer += chunk;
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const request = JSON.parse(line);
          
          // Handle the request
          this.handleRequest(request).then(response => {
            if (response) {
              process.stdout.write(JSON.stringify(response) + '\n');
            }
          }).catch(error => {
            log(`Error processing request: ${error.message}`);
            // Send proper error response
            const errorResponse = {
              jsonrpc: '2.0',
              id: request.id || null,
              error: {
                code: -32603,
                message: 'Internal error',
                data: error.message
              }
            };
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
          });
        } catch (error) {
          log(`Error parsing JSON: ${error.message}`);
          // Send parse error if there's likely an id
          const errorResponse = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error.message
            }
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    }
  }

  start() {
    log('MCP Server starting...');
    
    if (!process.env.OPENAI_API_KEY) {
      log('Warning: OPENAI_API_KEY not set. Image generation will fail.');
    }
    
    // Set up stdin
    process.stdin.setEncoding('utf8');
    
    // Ensure stdout is in line mode
    if (process.stdout._handle && process.stdout._handle.setBlocking) {
      process.stdout._handle.setBlocking(true);
    }
    
    process.stdin.on('data', chunk => this.processInput(chunk));
    process.stdin.on('end', () => {
      log('Input stream ended');
      process.exit(0);
    });
    
    // Handle errors
    process.on('uncaughtException', error => {
      log(`Uncaught exception: ${error.message}`);
      log(`Stack: ${error.stack}`);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      log(`Unhandled rejection: ${reason}`);
      process.exit(1);
    });
    
    // Ensure clean exit
    process.on('SIGINT', () => {
      log('Received SIGINT, shutting down gracefully');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      log('Received SIGTERM, shutting down gracefully');
      process.exit(0);
    });
    
    log('MCP Server ready');
  }
}

// Start the server
const server = new MCPServer();
server.start();
