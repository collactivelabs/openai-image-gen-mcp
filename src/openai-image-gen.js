const OpenAI = require('openai');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const logger = require('./utils/logger');
const { validateImageGenerationParams } = require('./utils/validation');

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

    // Initialize output directory asynchronously
    this.initPromise = this.initializeOutputDirectory();
  }

  /**
   * Initialize the output directory asynchronously
   * @private
   */
  async initializeOutputDirectory() {
    try {
      await fsPromises.access(this.outputDir);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await fsPromises.mkdir(this.outputDir, { recursive: true });
        logger.info(`Created output directory: ${this.outputDir}`);
      } catch (mkdirError) {
        logger.error(`Failed to create output directory: ${mkdirError.message}`);
        throw mkdirError;
      }
    }
  }

  /**
   * Ensure the output directory is ready before operations
   * @private
   */
  async ensureReady() {
    if (this.initPromise) {
      await this.initPromise;
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
      // Ensure output directory is ready
      await this.ensureReady();

      // Validate parameters before making API call
      const validatedParams = validateImageGenerationParams({
        prompt,
        ...options
      });

      logger.info(`Generating image with prompt: "${validatedParams.prompt.substring(0, 50)}..."`);
      logger.debug(`Image generation parameters: ${JSON.stringify({
        model: validatedParams.model,
        size: validatedParams.size,
        quality: validatedParams.quality,
        style: validatedParams.style,
        n: validatedParams.n
      })}`);

      const startTime = Date.now();

      // Build API request parameters
      const apiParams = {
        model: validatedParams.model,
        prompt: validatedParams.prompt,
        n: validatedParams.n,
        size: validatedParams.size,
        response_format: validatedParams.response_format || options.response_format || 'url'
      };

      // Add optional parameters based on model support
      if (validatedParams.quality) {
        apiParams.quality = validatedParams.quality;
      }
      if (validatedParams.style) {
        apiParams.style = validatedParams.style;
      }

      const response = await this.openai.images.generate(apiParams);

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
   * @param {number} timeout - Download timeout in milliseconds (default: 30000)
   * @returns {Promise<string>} - The path to the saved image
   */
  async saveImage(imageUrl, filename, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const fullPath = path.join(this.outputDir, filename);
      let file = null;
      let completed = false;
      let timeoutId = null;

      // Cleanup function
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (file && !completed) {
          file.close();
          // Delete incomplete file
          fs.unlink(fullPath, (err) => {
            if (err) {
              logger.debug(`Could not delete incomplete file ${fullPath}: ${err.message}`);
            }
          });
        }
      };

      try {
        file = fs.createWriteStream(fullPath);

        // Set up timeout
        timeoutId = setTimeout(() => {
          if (!completed) {
            completed = true;
            cleanup();
            const error = new Error(`Download timeout after ${timeout}ms`);
            error.code = 'ETIMEDOUT';
            logger.error(`Download timeout for ${imageUrl}`);
            reject(error);
          }
        }, timeout);

        const request = https.get(imageUrl, (response) => {
          // Check for HTTP errors
          if (response.statusCode !== 200) {
            completed = true;
            cleanup();
            const error = new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
            error.statusCode = response.statusCode;
            logger.error(`HTTP error downloading image from ${imageUrl}:`, error);
            reject(error);
            return;
          }

          // Check content type
          const contentType = response.headers['content-type'];
          if (contentType && !contentType.startsWith('image/')) {
            completed = true;
            cleanup();
            const error = new Error(`Invalid content type: ${contentType}`);
            error.contentType = contentType;
            logger.error(`Invalid content type for image from ${imageUrl}: ${contentType}`);
            reject(error);
            return;
          }

          // Pipe the response to file
          response.pipe(file);

          // Handle stream errors
          response.on('error', (err) => {
            if (!completed) {
              completed = true;
              cleanup();
              logger.error(`Error reading response stream from ${imageUrl}:`, err);
              reject(err);
            }
          });

          file.on('error', (err) => {
            if (!completed) {
              completed = true;
              cleanup();
              logger.error(`Error writing file ${fullPath}:`, err);
              reject(err);
            }
          });

          file.on('finish', () => {
            if (!completed) {
              completed = true;
              clearTimeout(timeoutId);
              file.close((err) => {
                if (err) {
                  logger.error(`Error closing file ${fullPath}:`, err);
                  reject(err);
                } else {
                  logger.info(`Image saved to ${fullPath}`);
                  resolve(fullPath);
                }
              });
            }
          });
        });

        // Handle request errors
        request.on('error', (err) => {
          if (!completed) {
            completed = true;
            cleanup();
            logger.error(`Error downloading image from ${imageUrl}:`, err);
            reject(err);
          }
        });

        // Set request timeout
        request.setTimeout(timeout, () => {
          if (!completed) {
            completed = true;
            request.destroy();
            cleanup();
            const error = new Error(`Request timeout after ${timeout}ms`);
            error.code = 'ETIMEDOUT';
            logger.error(`Request timeout for ${imageUrl}`);
            reject(error);
          }
        });
      } catch (err) {
        completed = true;
        cleanup();
        logger.error(`Unexpected error saving image:`, err);
        reject(err);
      }
    });
  }
  
  /**
   * Generate an image and save it to the filesystem
   * @param {string} prompt - The prompt to generate an image from
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated image data and file path
   */
  async generateAndSaveImage(prompt, options = {}) {
    // Ensure output directory is ready
    await this.ensureReady();

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
   * Create variations of an image
   * @param {string|Buffer} image - Path to image file or Buffer
   * @param {Object} options - Variation options
   * @param {number} options.n - Number of variations (1-10)
   * @param {string} options.size - Image size
   * @param {string} options.model - Model (only dall-e-2 supports variations)
   * @returns {Promise<Array>} - Generated variation data
   */
  async createImageVariation(image, options = {}) {
    try {
      await this.ensureReady();

      const model = options.model || 'dall-e-2';
      const size = options.size || '1024x1024';
      const n = options.n || 1;

      // Validate model (only dall-e-2 supports variations)
      if (model !== 'dall-e-2') {
        throw new Error('Image variations are only supported by dall-e-2');
      }

      logger.info(`Creating ${n} variation(s) of image`);
      logger.debug(`Variation parameters: model=${model}, size=${size}, n=${n}`);

      const startTime = Date.now();

      // Create readable stream from image path or buffer
      const imageStream = typeof image === 'string' ? fs.createReadStream(image) : image;

      const response = await this.openai.images.createVariation({
        model,
        image: imageStream,
        n,
        size,
        response_format: options.response_format || 'url'
      });

      const duration = Date.now() - startTime;
      logger.info(`Variations created successfully in ${duration}ms`);

      return response.data;
    } catch (error) {
      logger.error('Error creating image variation:', error);
      throw error;
    }
  }

  /**
   * Create variations and save them
   * @param {string|Buffer} image - Path to image file or Buffer
   * @param {Object} options - Variation options
   * @returns {Promise<Array>} - Array of variation data with file paths
   */
  async createAndSaveImageVariation(image, options = {}) {
    await this.ensureReady();

    const variations = await this.createImageVariation(image, options);
    const results = [];

    for (let i = 0; i < variations.length; i++) {
      if (variations[i].url) {
        const filename = `variation_${Date.now()}_${i}.png`;
        const filePath = await this.saveImage(variations[i].url, filename);
        results.push({
          ...variations[i],
          filePath
        });
      }
    }

    return results;
  }

  /**
   * Edit an image based on a prompt
   * @param {string|Buffer} image - Path to source image or Buffer
   * @param {string} prompt - Text description of desired edit
   * @param {Object} options - Edit options
   * @param {string|Buffer} options.mask - Optional mask image (PNG with transparency)
   * @param {string} options.model - Model (only dall-e-2 supports editing)
   * @param {number} options.n - Number of edits to generate
   * @param {string} options.size - Output size
   * @returns {Promise<Array>} - Generated edit data
   */
  async editImage(image, prompt, options = {}) {
    try {
      await this.ensureReady();

      const model = options.model || 'dall-e-2';
      const size = options.size || '1024x1024';
      const n = options.n || 1;

      // Validate model (only dall-e-2 supports editing)
      if (model !== 'dall-e-2') {
        throw new Error('Image editing is only supported by dall-e-2');
      }

      logger.info(`Editing image with prompt: "${prompt.substring(0, 50)}..."`);
      logger.debug(`Edit parameters: model=${model}, size=${size}, n=${n}`);

      const startTime = Date.now();

      // Create readable stream from image path or buffer
      const imageStream = typeof image === 'string' ? fs.createReadStream(image) : image;

      const params = {
        model,
        image: imageStream,
        prompt,
        n,
        size,
        response_format: options.response_format || 'url'
      };

      // Add mask if provided
      if (options.mask) {
        const maskStream = typeof options.mask === 'string' ?
          fs.createReadStream(options.mask) : options.mask;
        params.mask = maskStream;
      }

      const response = await this.openai.images.edit(params);

      const duration = Date.now() - startTime;
      logger.info(`Image edited successfully in ${duration}ms`);

      return response.data;
    } catch (error) {
      logger.error('Error editing image:', error);
      throw error;
    }
  }

  /**
   * Edit image and save results
   * @param {string|Buffer} image - Path to source image or Buffer
   * @param {string} prompt - Text description of desired edit
   * @param {Object} options - Edit options
   * @returns {Promise<Array>} - Array of edit data with file paths
   */
  async editAndSaveImage(image, prompt, options = {}) {
    await this.ensureReady();

    const edits = await this.editImage(image, prompt, options);
    const results = [];

    for (let i = 0; i < edits.length; i++) {
      if (edits[i].url) {
        const filename = `edit_${Date.now()}_${i}.png`;
        const filePath = await this.saveImage(edits[i].url, filename);
        results.push({
          ...edits[i],
          filePath
        });
      }
    }

    return results;
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