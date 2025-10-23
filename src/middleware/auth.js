/**
 * Authentication middleware for the OpenAI Image Generation MCP
 * Provides basic bearer token authentication with timing-attack protection
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings match
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Create buffers from strings
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // If lengths don't match, still do comparison to prevent timing leak
  if (bufA.length !== bufB.length) {
    // Compare against a dummy buffer of the same length as bufA
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware to check for valid bearer token authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authMiddleware(req, res, next) {
  // Skip auth if no token is configured
  if (!process.env.MCP_AUTH_TOKEN) {
    logger.warn('No MCP_AUTH_TOKEN set. Running without authentication!');
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`Authentication failed: Missing or invalid authorization header from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token || !timingSafeEqual(token, process.env.MCP_AUTH_TOKEN)) {
    logger.warn(`Authentication failed: Invalid token from ${req.ip}`);
    return res.status(403).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  // Authentication successful
  next();
}

module.exports = authMiddleware;