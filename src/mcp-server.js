#!/usr/bin/env node

const path = require('path');
const OpenAIImageGenMCP = require('./openai-image-gen');
const { validateConfig } = require('./utils/config');
const { validateImageGenerationParams, ValidationError } = require('./utils/validation');

// Load environment variables from the project root
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (error) {
  // Continue without dotenv
}

// Log function that writes to stderr (for MCP protocol compliance)
// Only logs when MCP_MODE is not set to suppress JSON parsing errors
function log(message) {
  if (process.env.MCP_MODE !== 'true') {
    console.error(`[${new Date().toISOString()}] ${message}`);
  }
}

// Global variables to be initialized after config validation
let imageGenMCP = null;
let initialized = false;

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
              // Validate parameters
              let validatedParams;
              try {
                validatedParams = validateImageGenerationParams(args);
              } catch (validationError) {
                if (validationError instanceof ValidationError) {
                  log(`Validation error: ${validationError.message} (field: ${validationError.field})`);
                  return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                      code: -32602,
                      message: `Invalid parameters: ${validationError.message}`,
                      data: { field: validationError.field }
                    }
                  };
                }
                throw validationError;
              }

              // Use the OpenAIImageGenMCP class to generate the image
              const mcpInterface = imageGenMCP.getMCPInterface();
              const result = await mcpInterface.handler({
                ...validatedParams,
                save: validatedParams.save !== false // Default to true
              });

              if (result.success) {
                let responseText = `Image generated successfully!\n\nPrompt: ${validatedParams.prompt}`;

                if (result.data.filePath) {
                  responseText += `\n\nSaved to: ${result.data.filePath}`;
                }

                if (result.data.url || (result.data[0] && result.data[0].url)) {
                  const imageUrl = result.data.url || result.data[0].url;
                  responseText += `\n\nImage URL: ${imageUrl}`;
                }

                if (result.data.revised_prompt || (result.data[0] && result.data[0].revised_prompt)) {
                  const revisedPrompt = result.data.revised_prompt || result.data[0].revised_prompt;
                  responseText += `\n\nRevised prompt: ${revisedPrompt}`;
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
                throw new Error(result.error || 'Image generation failed');
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

  async start() {
    log('MCP Server starting...');

    try {
      // Validate configuration (but don't make API call yet to keep startup fast)
      const config = await validateConfig({
        validateApiKey: true,  // Skip API validation for faster startup
        exitOnError: false      // Handle errors gracefully
      });

      // Initialize the OpenAIImageGenMCP instance
      imageGenMCP = new OpenAIImageGenMCP(config.apiKey);
      log('OpenAI Image Generation MCP initialized');

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
    } catch (error) {
      log(`Failed to start MCP Server: ${error.message}`);
      process.exit(1);
    }
  }
}

// Start the server
const server = new MCPServer();
server.start();
