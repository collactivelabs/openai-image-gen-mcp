/**
 * Input validation utilities for OpenAI Image Generation MCP
 */

const logger = require('./logger');

// OpenAI API limits and constraints
const VALIDATION_RULES = {
  prompt: {
    minLength: 1,
    maxLength: 4000, // OpenAI's limit
    required: true
  },
  model: {
    enum: ['dall-e-2', 'dall-e-3'],
    default: 'dall-e-3'
  },
  size: {
    enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
    default: '1024x1024',
    // Model-specific constraints
    modelConstraints: {
      'dall-e-2': ['256x256', '512x512', '1024x1024'],
      'dall-e-3': ['1024x1024', '1792x1024', '1024x1792']
    }
  },
  quality: {
    enum: ['standard', 'hd'],
    default: 'standard',
    // Only dall-e-3 supports hd
    modelConstraints: {
      'dall-e-3': ['standard', 'hd'],
      'dall-e-2': ['standard']
    }
  },
  style: {
    enum: ['vivid', 'natural'],
    default: 'vivid',
    // Only dall-e-3 supports style
    modelConstraints: {
      'dall-e-3': ['vivid', 'natural'],
      'dall-e-2': null // style not supported
    }
  },
  n: {
    type: 'integer',
    min: 1,
    max: 10,
    default: 1,
    // Model-specific constraints
    modelConstraints: {
      'dall-e-2': { min: 1, max: 10 },
      'dall-e-3': { min: 1, max: 1 } // dall-e-3 only supports n=1
    }
  }
};

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate prompt parameter
 * @param {string} prompt - The prompt to validate
 * @throws {ValidationError} If validation fails
 */
function validatePrompt(prompt) {
  const rules = VALIDATION_RULES.prompt;

  if (rules.required && (prompt === undefined || prompt === null || prompt === '')) {
    throw new ValidationError('Prompt is required', 'prompt');
  }

  if (typeof prompt !== 'string') {
    throw new ValidationError('Prompt must be a string', 'prompt');
  }

  if (prompt.length < rules.minLength) {
    throw new ValidationError(`Prompt must be at least ${rules.minLength} character(s)`, 'prompt');
  }

  if (prompt.length > rules.maxLength) {
    throw new ValidationError(`Prompt must not exceed ${rules.maxLength} characters`, 'prompt');
  }

  // Check for potentially problematic content
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) {
    throw new ValidationError('Prompt cannot be empty or only whitespace', 'prompt');
  }

  return trimmedPrompt;
}

/**
 * Validate model parameter
 * @param {string} model - The model to validate
 * @returns {string} Validated model (or default)
 * @throws {ValidationError} If validation fails
 */
function validateModel(model) {
  const rules = VALIDATION_RULES.model;

  if (!model) {
    return rules.default;
  }

  if (!rules.enum.includes(model)) {
    throw new ValidationError(
      `Model must be one of: ${rules.enum.join(', ')}`,
      'model'
    );
  }

  return model;
}

/**
 * Validate size parameter
 * @param {string} size - The size to validate
 * @param {string} model - The model being used (for model-specific validation)
 * @returns {string} Validated size (or default)
 * @throws {ValidationError} If validation fails
 */
function validateSize(size, model = 'dall-e-3') {
  const rules = VALIDATION_RULES.size;

  if (!size) {
    return rules.default;
  }

  if (!rules.enum.includes(size)) {
    throw new ValidationError(
      `Size must be one of: ${rules.enum.join(', ')}`,
      'size'
    );
  }

  // Check model-specific constraints
  const allowedSizes = rules.modelConstraints[model];
  if (allowedSizes && !allowedSizes.includes(size)) {
    throw new ValidationError(
      `Size ${size} is not supported for model ${model}. Allowed sizes: ${allowedSizes.join(', ')}`,
      'size'
    );
  }

  return size;
}

/**
 * Validate quality parameter
 * @param {string} quality - The quality to validate
 * @param {string} model - The model being used
 * @returns {string} Validated quality (or default)
 * @throws {ValidationError} If validation fails
 */
function validateQuality(quality, model = 'dall-e-3') {
  const rules = VALIDATION_RULES.quality;

  if (!quality) {
    return rules.default;
  }

  if (!rules.enum.includes(quality)) {
    throw new ValidationError(
      `Quality must be one of: ${rules.enum.join(', ')}`,
      'quality'
    );
  }

  // Check model-specific constraints
  const allowedQualities = rules.modelConstraints[model];
  if (allowedQualities && !allowedQualities.includes(quality)) {
    throw new ValidationError(
      `Quality ${quality} is not supported for model ${model}. Allowed qualities: ${allowedQualities.join(', ')}`,
      'quality'
    );
  }

  return quality;
}

/**
 * Validate style parameter
 * @param {string} style - The style to validate
 * @param {string} model - The model being used
 * @returns {string|null} Validated style (or default, or null if not supported)
 * @throws {ValidationError} If validation fails
 */
function validateStyle(style, model = 'dall-e-3') {
  const rules = VALIDATION_RULES.style;

  // Check if style is supported for this model
  const allowedStyles = rules.modelConstraints[model];
  if (allowedStyles === null) {
    // Style not supported for this model
    if (style) {
      logger.warn(`Style parameter is not supported for ${model}, ignoring`);
    }
    return null;
  }

  if (!style) {
    return rules.default;
  }

  if (!rules.enum.includes(style)) {
    throw new ValidationError(
      `Style must be one of: ${rules.enum.join(', ')}`,
      'style'
    );
  }

  if (allowedStyles && !allowedStyles.includes(style)) {
    throw new ValidationError(
      `Style ${style} is not supported for model ${model}. Allowed styles: ${allowedStyles.join(', ')}`,
      'style'
    );
  }

  return style;
}

/**
 * Validate n parameter (number of images)
 * @param {number} n - The number of images to validate
 * @param {string} model - The model being used
 * @returns {number} Validated n (or default)
 * @throws {ValidationError} If validation fails
 */
function validateN(n, model = 'dall-e-3') {
  const rules = VALIDATION_RULES.n;

  if (n === undefined || n === null) {
    return rules.default;
  }

  // Coerce to number if string
  const numN = typeof n === 'string' ? parseInt(n, 10) : n;

  if (isNaN(numN) || !Number.isInteger(numN)) {
    throw new ValidationError('n must be an integer', 'n');
  }

  // Get model-specific constraints
  const constraints = rules.modelConstraints[model] || { min: rules.min, max: rules.max };

  if (numN < constraints.min || numN > constraints.max) {
    throw new ValidationError(
      `n must be between ${constraints.min} and ${constraints.max} for model ${model}`,
      'n'
    );
  }

  return numN;
}

/**
 * Validate all parameters for image generation
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validated and sanitized parameters
 * @throws {ValidationError} If validation fails
 */
function validateImageGenerationParams(params) {
  try {
    // Validate and sanitize each parameter
    const validatedParams = {
      prompt: validatePrompt(params.prompt),
      model: validateModel(params.model),
    };

    // Validate parameters that depend on the model
    validatedParams.size = validateSize(params.size, validatedParams.model);
    validatedParams.quality = validateQuality(params.quality, validatedParams.model);
    validatedParams.n = validateN(params.n, validatedParams.model);

    // Style is optional and model-dependent
    const style = validateStyle(params.style, validatedParams.model);
    if (style !== null) {
      validatedParams.style = style;
    }

    // Pass through other optional parameters
    if (params.save !== undefined) {
      validatedParams.save = Boolean(params.save);
    }

    if (params.response_format !== undefined) {
      if (!['url', 'b64_json'].includes(params.response_format)) {
        throw new ValidationError(
          'response_format must be either "url" or "b64_json"',
          'response_format'
        );
      }
      validatedParams.response_format = params.response_format;
    }

    logger.debug(`Validation successful for params: ${JSON.stringify(validatedParams)}`);
    return validatedParams;
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn(`Validation failed: ${error.message} (field: ${error.field})`);
    }
    throw error;
  }
}

module.exports = {
  validateImageGenerationParams,
  validatePrompt,
  validateModel,
  validateSize,
  validateQuality,
  validateStyle,
  validateN,
  ValidationError,
  VALIDATION_RULES
};
