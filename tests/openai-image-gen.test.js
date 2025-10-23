const OpenAIImageGenMCP = require('../src/openai-image-gen');

// Mock the OpenAI client
jest.mock('openai', () => {
  return function() {
    return {
      images: {
        generate: jest.fn().mockResolvedValue({
          data: [
            {
              url: 'https://example.com/test-image.png',
              revised_prompt: 'A revised test prompt'
            }
          ]
        })
      }
    };
  };
});

// Mock fs and fsPromises
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    on: jest.fn().mockImplementation(function(event, callback) {
      if (event === 'finish') {
        callback();
      }
      return this;
    }),
    close: jest.fn()
  }),
  unlink: jest.fn(),
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock https
jest.mock('https', () => ({
  get: jest.fn().mockImplementation((url, callback) => {
    const mockResponse = {
      statusCode: 200,
      statusMessage: 'OK',
      headers: { 'content-type': 'image/png' },
      pipe: jest.fn(),
      on: jest.fn().mockReturnThis()
    };
    callback(mockResponse);
    return {
      on: jest.fn().mockReturnThis(),
      setTimeout: jest.fn()
    };
  })
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mocked/path/to/image.png')
}));

describe('OpenAIImageGenMCP', () => {
  let imageGenMCP;
  
  beforeEach(() => {
    jest.clearAllMocks();
    imageGenMCP = new OpenAIImageGenMCP('test-api-key');
  });

  describe('constructor', () => {
    test('should initialize with the provided API key', () => {
      expect(imageGenMCP.openai).toBeDefined();
    });
  });

  describe('generateImage', () => {
    test('should generate an image with the given prompt', async () => {
      const result = await imageGenMCP.generateImage('Test prompt');
      
      expect(result).toEqual([
        {
          url: 'https://example.com/test-image.png',
          revised_prompt: 'A revised test prompt'
        }
      ]);
      
      expect(imageGenMCP.openai.images.generate).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'Test prompt',
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'url'
      });
    });

    test('should handle custom options', async () => {
      const options = {
        model: 'dall-e-3',  // Changed from dall-e-2 since hd is only supported by dall-e-3
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
        n: 1,  // Changed from 2 since dall-e-3 only supports n=1
        response_format: 'b64_json'
      };

      await imageGenMCP.generateImage('Test prompt', options);

      const lastCall = imageGenMCP.openai.images.generate.mock.calls[imageGenMCP.openai.images.generate.mock.calls.length - 1][0];
      expect(lastCall.model).toBe('dall-e-3');
      expect(lastCall.prompt).toBe('Test prompt');
      expect(lastCall.n).toBe(1);
      expect(lastCall.size).toBe('1024x1024');
      expect(lastCall.quality).toBe('hd');
      expect(lastCall.style).toBe('natural');
      expect(lastCall.response_format).toBe('b64_json');
    });
  });

  describe('saveImage', () => {
    test('should save an image from a URL', async () => {
      const result = await imageGenMCP.saveImage('https://example.com/image.png', 'test-image.png');
      
      expect(result).toBe('/mocked/path/to/image.png');
    });
  });

  describe('generateAndSaveImage', () => {
    test('should generate and save an image', async () => {
      const result = await imageGenMCP.generateAndSaveImage('Test prompt');
      
      expect(result).toEqual({
        url: 'https://example.com/test-image.png',
        revised_prompt: 'A revised test prompt',
        filePath: '/mocked/path/to/image.png'
      });
    });
  });

  describe('getMCPInterface', () => {
    test('should return the MCP interface', () => {
      const mcpInterface = imageGenMCP.getMCPInterface();

      expect(mcpInterface.name).toBe('openai_image_generation');
      expect(mcpInterface.description).toBe('Generate images using OpenAI\'s DALL-E models');
      expect(mcpInterface.parameters.required).toContain('prompt');
      expect(mcpInterface.handler).toBeDefined();
    });

    test('interface handler should call generateAndSaveImage when save is true', async () => {
      const mcpInterface = imageGenMCP.getMCPInterface();
      imageGenMCP.generateAndSaveImage = jest.fn().mockResolvedValue({ url: 'test-url' });

      const result = await mcpInterface.handler({ prompt: 'Test', save: true });

      expect(imageGenMCP.generateAndSaveImage).toHaveBeenCalledWith('Test', { prompt: 'Test', save: true });
      expect(result).toEqual({ success: true, data: { url: 'test-url' } });
    });

    test('interface handler should call generateImage when save is false', async () => {
      const mcpInterface = imageGenMCP.getMCPInterface();
      imageGenMCP.generateImage = jest.fn().mockResolvedValue({ url: 'test-url' });

      const result = await mcpInterface.handler({ prompt: 'Test', save: false });

      expect(imageGenMCP.generateImage).toHaveBeenCalledWith('Test', { prompt: 'Test', save: false });
      expect(result).toEqual({ success: true, data: { url: 'test-url' } });
    });

    test('interface handler should handle errors', async () => {
      const mcpInterface = imageGenMCP.getMCPInterface();
      imageGenMCP.generateAndSaveImage = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await mcpInterface.handler({ prompt: 'Test', save: true });

      expect(result).toEqual({ success: false, error: 'Test error' });
    });
  });
});