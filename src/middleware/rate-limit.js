/**
 * Rate limiting middleware for the OpenAI Image Generation MCP
 * Prevents API abuse and manages costs
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * Strict rate limiter for image generation endpoint
 * Allows 10 requests per hour per IP to prevent excessive OpenAI API costs
 */
const imageGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.IMAGE_GENERATION_RATE_LIMIT) || 10, // Configurable, default 10
  message: {
    success: false,
    error: 'Image generation rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  handler: (req, res) => {
    logger.warn(`Image generation rate limit exceeded for IP ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Image generation rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000),
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining
    });
  },
  // Custom key generator to use both IP and auth token (if present)
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Use a hash of the token to avoid storing raw tokens in memory
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
      return `${req.ip}-${tokenHash}`;
    }
    return req.ip;
  }
});

/**
 * Very permissive rate limiter for health checks
 * Allows 1000 requests per minute
 */
const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true // Don't count failed requests
});

module.exports = {
  generalLimiter,
  imageGenerationLimiter,
  healthCheckLimiter
};
