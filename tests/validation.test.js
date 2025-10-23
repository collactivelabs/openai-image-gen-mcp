const {
  validateImageGenerationParams,
  validatePrompt,
  validateModel,
  validateSize,
  validateQuality,
  validateStyle,
  validateN,
  ValidationError,
  VALIDATION_RULES
} = require('../src/utils/validation');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Validation Utilities', () => {
  describe('validatePrompt', () => {
    it('should accept valid prompts', () => {
      const result = validatePrompt('A beautiful sunset over mountains');
      expect(result).toBe('A beautiful sunset over mountains');
    });

    it('should throw error for missing prompt', () => {
      expect(() => validatePrompt()).toThrow(ValidationError);
      expect(() => validatePrompt('')).toThrow('Prompt is required');
    });

    it('should throw error for non-string prompt', () => {
      expect(() => validatePrompt(123)).toThrow('Prompt must be a string');
    });

    it('should throw error for prompt exceeding max length', () => {
      const longPrompt = 'a'.repeat(4001);
      expect(() => validatePrompt(longPrompt)).toThrow('must not exceed 4000 characters');
    });

    it('should throw error for whitespace-only prompt', () => {
      expect(() => validatePrompt('   ')).toThrow('cannot be empty or only whitespace');
    });

    it('should trim whitespace from prompt', () => {
      const result = validatePrompt('  test prompt  ');
      expect(result).toBe('test prompt');
    });
  });

  describe('validateModel', () => {
    it('should accept dall-e-2', () => {
      expect(validateModel('dall-e-2')).toBe('dall-e-2');
    });

    it('should accept dall-e-3', () => {
      expect(validateModel('dall-e-3')).toBe('dall-e-3');
    });

    it('should return default when model is undefined', () => {
      expect(validateModel()).toBe('dall-e-3');
    });

    it('should throw error for invalid model', () => {
      expect(() => validateModel('dall-e-1')).toThrow('Model must be one of');
    });
  });

  describe('validateSize', () => {
    it('should accept valid sizes', () => {
      expect(validateSize('1024x1024', 'dall-e-3')).toBe('1024x1024');
      expect(validateSize('512x512', 'dall-e-2')).toBe('512x512');
    });

    it('should return default when size is undefined', () => {
      expect(validateSize()).toBe('1024x1024');
    });

    it('should throw error for invalid size', () => {
      expect(() => validateSize('2048x2048')).toThrow('Size must be one of');
    });

    it('should enforce model-specific size constraints for dall-e-2', () => {
      expect(() => validateSize('1792x1024', 'dall-e-2')).toThrow('not supported for model dall-e-2');
    });

    it('should accept dall-e-3 sizes for dall-e-3', () => {
      expect(validateSize('1792x1024', 'dall-e-3')).toBe('1792x1024');
    });
  });

  describe('validateQuality', () => {
    it('should accept standard quality', () => {
      expect(validateQuality('standard')).toBe('standard');
    });

    it('should accept hd quality for dall-e-3', () => {
      expect(validateQuality('hd', 'dall-e-3')).toBe('hd');
    });

    it('should throw error for hd quality with dall-e-2', () => {
      expect(() => validateQuality('hd', 'dall-e-2')).toThrow('not supported for model dall-e-2');
    });

    it('should return default when quality is undefined', () => {
      expect(validateQuality()).toBe('standard');
    });
  });

  describe('validateStyle', () => {
    it('should accept vivid style for dall-e-3', () => {
      expect(validateStyle('vivid', 'dall-e-3')).toBe('vivid');
    });

    it('should accept natural style for dall-e-3', () => {
      expect(validateStyle('natural', 'dall-e-3')).toBe('natural');
    });

    it('should return null for dall-e-2', () => {
      expect(validateStyle('vivid', 'dall-e-2')).toBeNull();
    });

    it('should return default for dall-e-3 when style is undefined', () => {
      expect(validateStyle(undefined, 'dall-e-3')).toBe('vivid');
    });
  });

  describe('validateN', () => {
    it('should accept valid n values', () => {
      expect(validateN(1, 'dall-e-3')).toBe(1);
      expect(validateN(5, 'dall-e-2')).toBe(5);
    });

    it('should return default when n is undefined', () => {
      expect(validateN()).toBe(1);
    });

    it('should throw error for n > 1 with dall-e-3', () => {
      expect(() => validateN(2, 'dall-e-3')).toThrow('must be between 1 and 1');
    });

    it('should accept n > 1 with dall-e-2', () => {
      expect(validateN(5, 'dall-e-2')).toBe(5);
    });

    it('should throw error for non-integer n', () => {
      expect(() => validateN(1.5)).toThrow('must be an integer');
    });

    it('should coerce string numbers to integers', () => {
      expect(validateN('5', 'dall-e-2')).toBe(5);
    });

    it('should throw error for n out of range', () => {
      expect(() => validateN(0)).toThrow('must be between');
      expect(() => validateN(11, 'dall-e-2')).toThrow('must be between');
    });
  });

  describe('validateImageGenerationParams', () => {
    it('should validate and return complete params with defaults', () => {
      const result = validateImageGenerationParams({
        prompt: 'test prompt'
      });

      expect(result.prompt).toBe('test prompt');
      expect(result.model).toBe('dall-e-3');
      expect(result.size).toBe('1024x1024');
      expect(result.quality).toBe('standard');
      expect(result.n).toBe(1);
    });

    it('should validate and return custom params', () => {
      const result = validateImageGenerationParams({
        prompt: 'test prompt',
        model: 'dall-e-2',
        size: '512x512',
        quality: 'standard',
        n: 3
      });

      expect(result.model).toBe('dall-e-2');
      expect(result.size).toBe('512x512');
      expect(result.n).toBe(3);
    });

    it('should exclude style for dall-e-2', () => {
      const result = validateImageGenerationParams({
        prompt: 'test',
        model: 'dall-e-2',
        style: 'vivid'
      });

      expect(result.style).toBeUndefined();
    });

    it('should include style for dall-e-3', () => {
      const result = validateImageGenerationParams({
        prompt: 'test',
        model: 'dall-e-3',
        style: 'natural'
      });

      expect(result.style).toBe('natural');
    });

    it('should throw ValidationError with field information', () => {
      try {
        validateImageGenerationParams({});
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.field).toBe('prompt');
      }
    });

    it('should validate response_format parameter', () => {
      const result = validateImageGenerationParams({
        prompt: 'test',
        response_format: 'b64_json'
      });

      expect(result.response_format).toBe('b64_json');
    });

    it('should throw error for invalid response_format', () => {
      expect(() => validateImageGenerationParams({
        prompt: 'test',
        response_format: 'invalid'
      })).toThrow('must be either "url" or "b64_json"');
    });

    it('should handle save parameter as boolean', () => {
      const result1 = validateImageGenerationParams({
        prompt: 'test',
        save: true
      });
      expect(result1.save).toBe(true);

      const result2 = validateImageGenerationParams({
        prompt: 'test',
        save: 'false'
      });
      expect(result2.save).toBe(true); // String coerced to boolean
    });
  });

  describe('ValidationError', () => {
    it('should create error with field information', () => {
      const error = new ValidationError('Test error', 'testField');

      expect(error.message).toBe('Test error');
      expect(error.field).toBe('testField');
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('VALIDATION_RULES', () => {
    it('should export validation rules', () => {
      expect(VALIDATION_RULES).toBeDefined();
      expect(VALIDATION_RULES.prompt).toBeDefined();
      expect(VALIDATION_RULES.model).toBeDefined();
      expect(VALIDATION_RULES.size).toBeDefined();
    });
  });
});
