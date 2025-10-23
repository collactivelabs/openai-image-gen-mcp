const express = require('express');
const bodyParser = require('body-parser');
const OpenAIImageGenMCP = require('./openai-image-gen');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('./middleware/auth');
const { generalLimiter, imageGenerationLimiter, healthCheckLimiter } = require('./middleware/rate-limit');
const logger = require('./utils/logger');
const { validateConfig } = require('./utils/config');
const { scheduleCleanup, getImageStats, cleanupOldImages } = require('./utils/image-cleanup');
const { metrics, metricsMiddleware, trackImageGeneration } = require('./utils/metrics');

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
    app.use(metricsMiddleware); // Track request metrics

    // Apply general rate limiting to all routes (except health check)
    app.use('/mcp', generalLimiter);
    app.use('/images', generalLimiter);

    // Initialize the OpenAI Image Generation MCP
    const imageGenMCP = new OpenAIImageGenMCP(config.apiKey);
    const mcpInterface = imageGenMCP.getMCPInterface();

    // Serve static files from the generated-images directory
    const fsPromises = require('fs').promises;
    const imagesDir = config.outputDir || path.join(process.cwd(), 'generated-images');
    try {
      await fsPromises.access(imagesDir);
    } catch (error) {
      await fsPromises.mkdir(imagesDir, { recursive: true });
      logger.info(`Created images directory: ${imagesDir}`);
    }
    app.use('/images', express.static(imagesDir));

    // Set up automatic image cleanup if enabled
    let cleanupScheduler = null;
    if (config.imageCleanupEnabled) {
      logger.info('Image cleanup is enabled');
      cleanupScheduler = scheduleCleanup(imagesDir, {
        retentionMs: config.imageRetentionDays * 24 * 60 * 60 * 1000,
        maxFiles: config.imageMaxCount,
        intervalMs: config.imageCleanupIntervalHours * 60 * 60 * 1000
      });
    } else {
      logger.info('Image cleanup is disabled. Set IMAGE_CLEANUP_ENABLED=true to enable.');
    }

    // Health check endpoint (with permissive rate limiting)
    app.get('/health', healthCheckLimiter, (req, res) => {
      res.json({ status: 'ok' });
    });

    // Image stats endpoint
    app.get('/admin/images/stats', authMiddleware, async (req, res) => {
      try {
        const stats = await getImageStats(imagesDir);
        res.json({
          success: true,
          stats,
          cleanup: {
            enabled: config.imageCleanupEnabled,
            retentionDays: config.imageRetentionDays,
            maxFiles: config.imageMaxCount,
            intervalHours: config.imageCleanupIntervalHours
          }
        });
      } catch (error) {
        logger.error('Error getting image stats:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Manual cleanup endpoint
    app.post('/admin/images/cleanup', authMiddleware, async (req, res) => {
      try {
        const dryRun = req.body.dryRun || false;

        const results = await cleanupOldImages(imagesDir, {
          retentionMs: config.imageRetentionDays * 24 * 60 * 60 * 1000,
          maxFiles: config.imageMaxCount,
          dryRun
        });

        res.json({
          success: true,
          results,
          dryRun
        });
      } catch (error) {
        logger.error('Error running manual cleanup:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Metrics endpoints
    app.get('/metrics', (req, res) => {
      // Prometheus text format
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics.getPrometheusMetrics());
    });

    app.get('/admin/metrics', authMiddleware, (req, res) => {
      // JSON format with more details
      res.json({
        success: true,
        metrics: metrics.getMetrics()
      });
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

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Track image generation metrics
        trackImageGeneration(
          validatedParams,
          responseTime,
          result.success,
          result.success ? null : result.error
        );

        // If the image was saved, replace the file path with a URL
        if (result.success && result.data.filePath) {
          const filename = path.basename(result.data.filePath);
          result.data.imageUrl = `${req.protocol}://${req.get('host')}/images/${filename}`;
        }

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