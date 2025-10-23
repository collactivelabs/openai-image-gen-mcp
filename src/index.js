const express = require('express');
const bodyParser = require('body-parser');
const OpenAIImageGenMCP = require('./openai-image-gen');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('./middleware/auth');
const { generalLimiter, imageGenerationLimiter, healthCheckLimiter } = require('./middleware/rate-limit');
const logger = require('./utils/logger');
const { validateConfig } = require('./utils/config');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (error) {
  // dotenv is optional, silently continue without it
}

// Validate configuration before starting server
(async () => {
  try {
    const config = await validateConfig({
      validateApiKey: true,  // Validate API key with OpenAI
      exitOnError: true      // Exit if validation fails
    });

    const app = express();
    const PORT = config.port;

    // Middleware
    app.use(bodyParser.json());
    app.use(express.static(path.join(__dirname, '../public')));

    // Apply general rate limiting to all routes (except health check)
    app.use('/mcp', generalLimiter);
    app.use('/images', generalLimiter);

    // Initialize the OpenAI Image Generation MCP
    const imageGenMCP = new OpenAIImageGenMCP(config.apiKey);
    const mcpInterface = imageGenMCP.getMCPInterface();

    // Serve static files from the generated-images directory
    const fsPromises = require('fs').promises;
    const imagesDir = path.join(process.cwd(), 'generated-images');
    try {
      await fsPromises.access(imagesDir);
    } catch (error) {
      await fsPromises.mkdir(imagesDir, { recursive: true });
      logger.info(`Created images directory: ${imagesDir}`);
    }
    app.use('/images', express.static(imagesDir));

    // Health check endpoint (with permissive rate limiting)
    app.get('/health', healthCheckLimiter, (req, res) => {
      res.json({ status: 'ok' });
    });

    // MCP descriptor endpoint
    app.get('/mcp', authMiddleware, (req, res) => {
      res.json({
        name: mcpInterface.name,
        description: mcpInterface.description,
        parameters: mcpInterface.parameters
      });
    });

    // MCP execution endpoint (with strict rate limiting for image generation)
    app.post('/mcp', imageGenerationLimiter, authMiddleware, async (req, res) => {
      const startTime = Date.now();

      try {
        const params = req.body;

        // Log request received
        logger.request(req, 'received', { prompt: params.prompt });

        // Validate parameters using validation utility
        const { validateImageGenerationParams, ValidationError } = require('./utils/validation');
        let validatedParams;

        try {
          validatedParams = validateImageGenerationParams(params);
        } catch (error) {
          if (error instanceof ValidationError) {
            logger.request(req, 'failed', { error: error.message, field: error.field });
            return res.status(400).json({
              success: false,
              error: error.message,
              field: error.field
            });
          }
          throw error; // Re-throw unexpected errors
        }

        // Log request processing
        logger.request(req, 'processing', { prompt: validatedParams.prompt });

        // Call the handler function with the validated parameters
        const result = await mcpInterface.handler(validatedParams);

        // If the image was saved, replace the file path with a URL
        if (result.success && result.data.filePath) {
          const filename = path.basename(result.data.filePath);
          result.data.imageUrl = `${req.protocol}://${req.get('host')}/images/${filename}`;
        }

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Log request completed
        logger.request(req, 'completed', {
          prompt: params.prompt,
          responseTime,
          success: result.success
        });

        res.json(result);
      } catch (error) {
        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Log error
        logger.error('Error processing MCP request:', error);
        logger.request(req, 'failed', {
          error: error.message,
          responseTime
        });

        res.status(500).json({
          success: false,
          error: error.message || 'Internal server error'
        });
      }
    });

    // Start the server
    app.listen(PORT, () => {
      logger.info(`OpenAI Image Generation MCP server running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`Web UI available at http://localhost:${PORT}/`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();