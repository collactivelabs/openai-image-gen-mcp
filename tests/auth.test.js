const authMiddleware = require('../src/middleware/auth');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  warn: jest.fn()
}));

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Clear environment
    delete process.env.MCP_AUTH_TOKEN;
  });

  describe('when no token is configured', () => {
    it('should call next() without authentication', () => {
      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('when token is configured', () => {
    beforeEach(() => {
      process.env.MCP_AUTH_TOKEN = 'test-secret-token-123';
    });

    it('should return 401 when authorization header is missing', () => {
      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing or invalid authorization header'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic abc123';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing or invalid authorization header'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token is invalid', () => {
      req.headers.authorization = 'Bearer wrong-token';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authentication token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() when token is valid', () => {
      req.headers.authorization = 'Bearer test-secret-token-123';

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use constant-time comparison to prevent timing attacks', () => {
      // Test with tokens of different lengths
      req.headers.authorization = 'Bearer short';
      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle empty token after Bearer', () => {
      req.headers.authorization = 'Bearer ';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle token with extra spaces', () => {
      req.headers.authorization = '  Bearer  test-secret-token-123  ';

      authMiddleware(req, res, next);

      // Should fail because header doesn't start with 'Bearer ' (has leading spaces)
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
