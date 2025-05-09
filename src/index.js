const express = require('express');
const bodyParser = require('body-parser');
const OpenAIImageGenMCP = require('./openai-image-gen');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('./middleware/auth');
const logger = require('./utils/logger');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (error) {
  console.warn('dotenv package not found, skipping .env file loading');
}

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize the OpenAI Image Generation MCP
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  logger.warn('Warning: OPENAI_API_KEY environment variable not set');
}

const imageGenMCP = new OpenAIImageGenMCP(apiKey);
const mcpInterface = imageGenMCP.getMCPInterface();

// Serve static files from the generated-images directory
const imagesDir = path.join(process.cwd(), 'generated-images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
app.use('/images', express.static(imagesDir));

// Health check endpoint
app.get('/health', (req, res) => {
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

// MCP execution endpoint
app.post('/mcp', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const params = req.body;
    
    // Log request received
    logger.request(req, 'received', { prompt: params.prompt });
    
    // Validate required parameters
    if (!params.prompt) {
      logger.request(req, 'failed', { error: 'Missing required parameter: prompt' });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameter: prompt' 
      });
    }
    
    // Log request processing
    logger.request(req, 'processing', { prompt: params.prompt });
    
    // Call the handler function with the parameters
    const result = await mcpInterface.handler(params);
    
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
});