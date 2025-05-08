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

// Mock fs
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
  unlink: jest.fn()
}));

// Mock https
jest.mock('https', () => ({
  get: jest.fn().mockImplementation((url, callback) => {
    const mockResponse = {
      pipe: jest.fn()
    };
    callback(mockResponse);
    return {
      on: jest.fn().mockImplementation(function(event, callback) {
        return this;
      })
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
        model: 'dall-e-2',
        size: '512x512',
        quality: 'hd',
        style: 'natural',
        n: 2,
        response_format: 'b64_json'
      };
      
      await imageGenMCP.generateImage('Test prompt', options);
      
      expect(imageGenMCP.openai.images.generate).toHaveBeenCalledWith({
        model: 'dall-e-2',
        prompt: 'Test prompt',
        n: 2,
        size: '512x512',
        quality: 'hd',
        style: 'natural',
        response_format: 'b64_json'
      });
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
      const interface = imageGenMCP.getMCPInterface();
      
      expect(interface.name).toBe('openai_image_generation');
      expect(interface.description).toBe('Generate images using OpenAI\'s DALL-E models');
      expect(interface.parameters.required).toContain('prompt');
      expect(interface.handler).toBeDefined();
    });
    
    test('interface handler should call generateAndSaveImage when save is true', async () => {
      const interface = imageGenMCP.getMCPInterface();
      imageGenMCP.generateAndSaveImage = jest.fn().mockResolvedValue({ url: 'test-url' });
      
      const result = await interface.handler({ prompt: 'Test', save: true });
      
      expect(imageGenMCP.generateAndSaveImage).toHaveBeenCalledWith('Test', { prompt: 'Test', save: true });
      expect(result).toEqual({ success: true, data: { url: 'test-url' } });
    });
    
    test('interface handler should call generateImage when save is false', async () => {
      const interface = imageGenMCP.getMCPInterface();
      imageGenMCP.generateImage = jest.fn().mockResolvedValue({ url: 'test-url' });
      
      const result = await interface.handler({ prompt: 'Test', save: false });
      
      expect(imageGenMCP.generateImage).toHaveBeenCalledWith('Test', { prompt: 'Test', save: false });
      expect(result).toEqual({ success: true, data: { url: 'test-url' } });
    });
    
    test('interface handler should handle errors', async () => {
      const interface = imageGenMCP.getMCPInterface();
      imageGenMCP.generateAndSaveImage = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await interface.handler({ prompt: 'Test', save: true });
      
      expect(result).toEqual({ success: false, error: 'Test error' });
    });
  });
});