/**
 * Authentication middleware for the OpenAI Image Generation MCP
 * Provides basic bearer token authentication
 */

/**
 * Middleware to check for valid bearer token authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authMiddleware(req, res, next) {
  // Skip auth if no token is configured
  if (!process.env.MCP_AUTH_TOKEN) {
    console.warn('Warning: No MCP_AUTH_TOKEN set. Running without authentication!');
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token || token !== process.env.MCP_AUTH_TOKEN) {
    return res.status(403).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }
  
  // Authentication successful
  next();
}

module.exports = authMiddleware;