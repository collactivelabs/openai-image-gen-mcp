/**
 * Configuration validation and management utilities
 */

const logger = require('./logger');

/**
 * Validate that a required environment variable is set
 * @param {string} varName - Name of the environment variable
 * @param {string} description - Human-readable description
 * @returns {string} The value of the environment variable
 * @throws {Error} If the variable is not set
 */
function requireEnvVar(varName, description) {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Missing required environment variable: ${varName} (${description})`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default value
 * @param {string} varName - Name of the environment variable
 * @param {*} defaultValue - Default value if not set
 * @returns {*} The value of the environment variable or default
 */
function getEnvVar(varName, defaultValue) {
  return process.env[varName] || defaultValue;
}

/**
 * Validate OpenAI API key format
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} True if format is valid
 */
function isValidOpenAIKeyFormat(apiKey) {
  // OpenAI API keys typically start with 'sk-' and are followed by alphanumeric characters
  // Modern keys may also start with 'sk-proj-' for project-specific keys
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Check format
  const validPrefixes = ['sk-', 'sk-proj-'];
  const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));

  if (!hasValidPrefix) {
    return false;
  }

  // Check length (OpenAI keys are typically 48-56 characters, but can vary)
  if (apiKey.length < 20 || apiKey.length > 200) {
    return false;
  }

  return true;
}

/**
 * Validate OpenAI API key by making a test API call
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<Object>} Validation result with {valid: boolean, error: string}
 */
async function validateOpenAIKey(apiKey) {
  if (!isValidOpenAIKeyFormat(apiKey)) {
    return {
      valid: false,
      error: 'Invalid API key format. OpenAI keys should start with "sk-" or "sk-proj-"'
    };
  }

  try {
    // Make a lightweight API call to validate the key
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });

    // List models as a lightweight validation check
    // This verifies the key is valid without incurring generation costs
    await client.models.list();

    return { valid: true };
  } catch (error) {
    // Parse the error to provide helpful feedback
    if (error.status === 401) {
      return {
        valid: false,
        error: 'Invalid API key. Please check your OPENAI_API_KEY.'
      };
    } else if (error.status === 429) {
      // Rate limited, but key is valid
      logger.warn('OpenAI API rate limit hit during validation, but key appears valid');
      return { valid: true };
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        valid: false,
        error: 'Unable to reach OpenAI API. Please check your internet connection.'
      };
    }

    return {
      valid: false,
      error: `API key validation failed: ${error.message}`
    };
  }
}

/**
 * Validate all required configuration for the MCP server
 * @param {Object} options - Validation options
 * @param {boolean} options.validateApiKey - Whether to make an API call to validate the key (default: true)
 * @param {boolean} options.exitOnError - Whether to exit process on validation failure (default: false)
 * @returns {Promise<Object>} Configuration object
 * @throws {Error} If validation fails and exitOnError is false
 */
async function validateConfig(options = {}) {
  const validateApiKey = options.validateApiKey !== false;
  const exitOnError = options.exitOnError || false;

  logger.info('Validating configuration...');

  try {
    // Check for required environment variables
    const apiKey = requireEnvVar('OPENAI_API_KEY', 'OpenAI API key for DALL-E access');

    // Validate API key format
    if (!isValidOpenAIKeyFormat(apiKey)) {
      throw new Error(
        'Invalid OPENAI_API_KEY format. OpenAI keys should start with "sk-" or "sk-proj-"'
      );
    }

    // Optionally validate API key by making a test call
    if (validateApiKey) {
      logger.info('Validating OpenAI API key...');
      const validation = await validateOpenAIKey(apiKey);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      logger.info('OpenAI API key validated successfully');
    }

    // Get optional configuration
    const config = {
      apiKey,
      port: parseInt(getEnvVar('PORT', '3010'), 10),
      authToken: process.env.MCP_AUTH_TOKEN,
      outputDir: getEnvVar('OUTPUT_DIR', './generated-images'),
      logLevel: parseInt(getEnvVar('LOG_LEVEL', '2'), 10),
      logToFile: getEnvVar('LOG_TO_FILE', 'false') === 'true',
      logFilePath: getEnvVar('LOG_FILE_PATH', './logs/mcp.log'),
      imageGenerationRateLimit: parseInt(getEnvVar('IMAGE_GENERATION_RATE_LIMIT', '10'), 10)
    };

    // Warn about missing optional security settings
    if (!config.authToken) {
      logger.warn('MCP_AUTH_TOKEN is not set. API will run without authentication.');
      logger.warn('This is not recommended for production environments.');
    }

    logger.info('Configuration validated successfully');
    return config;
  } catch (error) {
    logger.error('Configuration validation failed:', error);

    if (exitOnError) {
      logger.error('Exiting due to configuration error.');
      process.exit(1);
    }

    throw error;
  }
}

module.exports = {
  requireEnvVar,
  getEnvVar,
  isValidOpenAIKeyFormat,
  validateOpenAIKey,
  validateConfig
};
