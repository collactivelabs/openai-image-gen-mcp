const {
  requireEnvVar,
  getEnvVar,
  isValidOpenAIKeyFormat,
  validateOpenAIKey,
  validateConfig
} = require('../src/utils/config');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock OpenAI
jest.mock('openai');

describe('Configuration Utilities', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear test environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.PORT;
    delete process.env.MCP_AUTH_TOKEN;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('requireEnvVar', () => {
    it('should return the value when environment variable is set', () => {
      process.env.TEST_VAR = 'test-value';
      const result = requireEnvVar('TEST_VAR', 'Test variable');
      expect(result).toBe('test-value');
    });

    it('should throw error when environment variable is not set', () => {
      expect(() => requireEnvVar('MISSING_VAR', 'Missing variable'))
        .toThrow('Missing required environment variable: MISSING_VAR (Missing variable)');
    });

    it('should throw error when environment variable is empty', () => {
      process.env.EMPTY_VAR = '';
      expect(() => requireEnvVar('EMPTY_VAR', 'Empty variable'))
        .toThrow('Missing required environment variable');
    });
  });

  describe('getEnvVar', () => {
    it('should return the value when environment variable is set', () => {
      process.env.TEST_VAR = 'test-value';
      const result = getEnvVar('TEST_VAR', 'default');
      expect(result).toBe('test-value');
    });

    it('should return default when environment variable is not set', () => {
      const result = getEnvVar('MISSING_VAR', 'default-value');
      expect(result).toBe('default-value');
    });

    it('should return default when environment variable is empty', () => {
      process.env.EMPTY_VAR = '';
      const result = getEnvVar('EMPTY_VAR', 'default-value');
      expect(result).toBe('default-value');
    });
  });

  describe('isValidOpenAIKeyFormat', () => {
    it('should return true for valid sk- format', () => {
      expect(isValidOpenAIKeyFormat('sk-abc123def456ghi789')).toBe(true);
    });

    it('should return true for valid sk-proj- format', () => {
      expect(isValidOpenAIKeyFormat('sk-proj-abc123def456ghi789')).toBe(true);
    });

    it('should return false for keys without proper prefix', () => {
      expect(isValidOpenAIKeyFormat('abc123def456')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isValidOpenAIKeyFormat(null)).toBe(false);
      expect(isValidOpenAIKeyFormat(undefined)).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidOpenAIKeyFormat(123)).toBe(false);
      expect(isValidOpenAIKeyFormat({})).toBe(false);
    });

    it('should return false for too short keys', () => {
      expect(isValidOpenAIKeyFormat('sk-abc')).toBe(false);
    });

    it('should return false for too long keys', () => {
      const longKey = 'sk-' + 'a'.repeat(200);
      expect(isValidOpenAIKeyFormat(longKey)).toBe(false);
    });
  });

  describe('validateOpenAIKey', () => {
    it('should return invalid for bad format', async () => {
      const result = await validateOpenAIKey('bad-key');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key format');
    });

    it('should return valid for successful API call', async () => {
      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        models: {
          list: jest.fn().mockResolvedValue({ data: [] })
        }
      }));

      const result = await validateOpenAIKey('sk-validkey123456789012345');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for 401 error', async () => {
      const OpenAI = require('openai');
      const error = new Error('Unauthorized');
      error.status = 401;

      OpenAI.mockImplementation(() => ({
        models: {
          list: jest.fn().mockRejectedValue(error)
        }
      }));

      const result = await validateOpenAIKey('sk-invalidkey123456789012345');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should return valid for 429 rate limit error', async () => {
      const OpenAI = require('openai');
      const error = new Error('Rate limit');
      error.status = 429;

      OpenAI.mockImplementation(() => ({
        models: {
          list: jest.fn().mockRejectedValue(error)
        }
      }));

      const result = await validateOpenAIKey('sk-ratelimitedkey123456789012345');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for network errors', async () => {
      const OpenAI = require('openai');
      const error = new Error('Network error');
      error.code = 'ENOTFOUND';

      OpenAI.mockImplementation(() => ({
        models: {
          list: jest.fn().mockRejectedValue(error)
        }
      }));

      const result = await validateOpenAIKey('sk-networkerrorkey123456789012345');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unable to reach OpenAI API');
    });
  });

  describe('validateConfig', () => {
    it('should throw error when OPENAI_API_KEY is missing', async () => {
      await expect(validateConfig({ exitOnError: false }))
        .rejects.toThrow('Missing required environment variable: OPENAI_API_KEY');
    });

    it('should throw error for invalid API key format', async () => {
      process.env.OPENAI_API_KEY = 'invalid-key';

      await expect(validateConfig({ validateApiKey: false, exitOnError: false }))
        .rejects.toThrow('Invalid OPENAI_API_KEY format');
    });

    it('should return config with defaults', async () => {
      process.env.OPENAI_API_KEY = 'sk-validkey123456789012345';

      const config = await validateConfig({
        validateApiKey: false,
        exitOnError: false
      });

      expect(config.apiKey).toBe('sk-validkey123456789012345');
      expect(config.port).toBe(3010);
      expect(config.authToken).toBeUndefined();
      expect(config.logLevel).toBe(2);
      expect(config.imageGenerationRateLimit).toBe(10);
    });

    it('should return config with custom values', async () => {
      process.env.OPENAI_API_KEY = 'sk-validkey123456789012345';
      process.env.PORT = '8080';
      process.env.MCP_AUTH_TOKEN = 'my-token';
      process.env.LOG_LEVEL = '3';
      process.env.IMAGE_GENERATION_RATE_LIMIT = '20';

      const config = await validateConfig({
        validateApiKey: false,
        exitOnError: false
      });

      expect(config.port).toBe(8080);
      expect(config.authToken).toBe('my-token');
      expect(config.logLevel).toBe(3);
      expect(config.imageGenerationRateLimit).toBe(20);
    });

    it('should validate API key when validateApiKey is true', async () => {
      process.env.OPENAI_API_KEY = 'sk-validkey123456789012345';

      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        models: {
          list: jest.fn().mockResolvedValue({ data: [] })
        }
      }));

      const config = await validateConfig({
        validateApiKey: true,
        exitOnError: false
      });

      expect(config.apiKey).toBe('sk-validkey123456789012345');
    });
  });
});
