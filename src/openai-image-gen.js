const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('./utils/logger');

/**
 * OpenAI Image Generation MCP
 * This MCP provides image generation capabilities using OpenAI's DALL-E models
 */
class OpenAIImageGenMCP {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
    
    // Default configs
    this.defaultModel = "dall-e-3";
    this.defaultSize = "1024x1024";
    this.defaultQuality = "standard";
    this.defaultStyle = "vivid";
    this.outputDir = path.join(process.cwd(), 'generated-images');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info(`Created output directory: ${this.outputDir}`);
    }
  }
  
  /**
   * Generate an image using OpenAI's DALL-E model
   * @param {string} prompt - The prompt to generate an image from
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated image data
   */
  async generateImage(prompt, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const size = options.size || this.defaultSize;
      const quality = options.quality || this.defaultQuality;
      const style = options.style || this.defaultStyle;
      const n = options.n || 1;
      
      logger.info(`Generating image with prompt: "${prompt.substring(0, 50)}..."`);
      logger.debug(`Image generation parameters: model=${model}, size=${size}, quality=${quality}, style=${style}, n=${n}`);
      
      const startTime = Date.now();
      const response = await this.openai.images.generate({
        model,
        prompt,
        n,
        size,
        quality,
        style,
        response_format: options.response_format || 'url'
      });
      
      const duration = Date.now() - startTime;
      logger.info(`Image generated successfully in ${duration}ms`);
      
      return response.data;
    } catch (error) {
      logger.error('Error generating image:', error);
      throw error;
    }
  }
  
  /**
   * Save an image from a URL to the local filesystem
   * @param {string} imageUrl - The URL of the image to save
   * @param {string} filename - The filename to save the image as
   * @returns {Promise<string>} - The path to the saved image
   */
  async saveImage(imageUrl, filename) {
    return new Promise((resolve, reject) => {
      const fullPath = path.join(this.outputDir, filename);
      const file = fs.createWriteStream(fullPath);
      
      https.get(imageUrl, (response) => {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          logger.info(`Image saved to ${fullPath}`);
          resolve(fullPath);
        });
      }).on('error', (err) => {
        logger.error(`Error downloading image from ${imageUrl}:`, err);
        fs.unlink(fullPath, () => {}); // Delete the file if there's an error
        reject(err);
      });
    });
  }
  
  /**
   * Generate an image and save it to the filesystem
   * @param {string} prompt - The prompt to generate an image from
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated image data and file path
   */
  async generateAndSaveImage(prompt, options = {}) {
    const imageData = await this.generateImage(prompt, options);
    const filename = `image_${Date.now()}.png`;
    
    if (imageData[0] && imageData[0].url) {
      const filePath = await this.saveImage(imageData[0].url, filename);
      return {
        ...imageData[0],
        filePath
      };
    }
    
    return imageData;
  }
  
  /**
   * Define the MCP interface for Claude
   * @returns {Object} The MCP interface definition
   */
  getMCPInterface() {
    return {
      name: "openai_image_generation",
      description: "Generate images using OpenAI's DALL-E models",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "A detailed text description of the image you want to generate"
          },
          model: {
            type: "string",
            enum: ["dall-e-2", "dall-e-3"],
            description: "The DALL-E model to use for generation",
            default: this.defaultModel
          },
          size: {
            type: "string",
            enum: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
            description: "The size of the generated image",
            default: this.defaultSize
          },
          quality: {
            type: "string",
            enum: ["standard", "hd"],
            description: "The quality of the generated image",
            default: this.defaultQuality
          },
          style: {
            type: "string",
            enum: ["vivid", "natural"],
            description: "The style of the generated image",
            default: this.defaultStyle
          },
          n: {
            type: "integer",
            description: "The number of images to generate",
            default: 1,
            minimum: 1,
            maximum: 10
          },
          save: {
            type: "boolean",
            description: "Whether to save the generated image to the filesystem",
            default: true
          }
        },
        required: ["prompt"]
      },
      handler: async (params) => {
        try {
          if (params.save) {
            const result = await this.generateAndSaveImage(params.prompt, params);
            return {
              success: true,
              data: result
            };
          } else {
            const result = await this.generateImage(params.prompt, params);
            return {
              success: true,
              data: result
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }
}

module.exports = OpenAIImageGenMCP;