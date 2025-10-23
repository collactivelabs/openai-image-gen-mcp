/**
 * Simple logging utility for the OpenAI Image Generation MCP
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);
    this.logToFile = options.logToFile || false;
    this.logFilePath = options.logFilePath || path.join(process.cwd(), 'logs', 'mcp.log');
    this.initPromise = null;

    // Initialize logs directory asynchronously if logging to file
    if (this.logToFile) {
      this.initPromise = this.initializeLogDirectory();
    }
  }

  /**
   * Initialize the log directory asynchronously
   * @private
   */
  async initializeLogDirectory() {
    const logsDir = path.dirname(this.logFilePath);
    try {
      await fsPromises.access(logsDir);
    } catch (error) {
      await fsPromises.mkdir(logsDir, { recursive: true });
    }
  }
  
  /**
   * Format a log message with timestamp and level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @returns {string} Formatted log message
   */
  formatLogMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }
  
  /**
   * Write a log message to the log file
   * @param {string} message - Formatted log message
   */
  async writeToFile(message) {
    if (!this.logToFile) return;

    try {
      // Ensure log directory is ready
      if (this.initPromise) {
        await this.initPromise;
        this.initPromise = null; // Clear after first use
      }

      await fsPromises.appendFile(this.logFilePath, message + '\n');
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error.message);
    }
  }
  
  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object
   */
  error(message, error) {
    if (this.logLevel >= LOG_LEVELS.ERROR) {
      const formattedMessage = this.formatLogMessage('ERROR', message);
      // Only output to stderr in MCP mode for critical errors
      if (process.env.MCP_MODE !== 'true') {
        console.error(formattedMessage);
        if (error) {
          console.error(error);
        }
      }

      this.writeToFile(formattedMessage);
      if (error) {
        this.writeToFile(error.stack || error.toString());
      }
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   */
  warn(message) {
    if (this.logLevel >= LOG_LEVELS.WARN) {
      const formattedMessage = this.formatLogMessage('WARN', message);
      // Suppress warnings in MCP mode to avoid JSON-RPC interference
      if (process.env.MCP_MODE !== 'true') {
        console.warn(formattedMessage);
      }
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   */
  info(message) {
    if (this.logLevel >= LOG_LEVELS.INFO) {
      const formattedMessage = this.formatLogMessage('INFO', message);
      // Suppress info logs in MCP mode to avoid JSON-RPC interference
      if (process.env.MCP_MODE !== 'true') {
        console.info(formattedMessage);
      }
      this.writeToFile(formattedMessage);
    }
  }
  
  /**
   * Log a debug message
   * @param {string} message - Debug message
   */
  debug(message) {
    if (this.logLevel >= LOG_LEVELS.DEBUG) {
      const formattedMessage = this.formatLogMessage('DEBUG', message);
      // Suppress debug logs in MCP mode to avoid JSON-RPC interference
      if (process.env.MCP_MODE !== 'true') {
        console.debug(formattedMessage);
      }
      this.writeToFile(formattedMessage);
    }
  }
  
  /**
   * Log request information for an MCP request
   * @param {Object} req - Express request object
   * @param {string} status - Request status (received, processing, completed, failed)
   * @param {Object} [data] - Optional additional data
   */
  request(req, status, data = {}) {
    const requestId = req.headers['x-request-id'] || 'unknown';
    const method = req.method;
    const path = req.path;
    const ip = req.ip;
    
    let message = `Request ${requestId} ${status} - ${method} ${path} from ${ip}`;
    
    if (data.prompt) {
      // Truncate long prompts
      const truncatedPrompt = data.prompt.length > 50 
        ? `${data.prompt.substring(0, 50)}...` 
        : data.prompt;
      
      message += ` - Prompt: "${truncatedPrompt}"`;
    }
    
    if (data.error) {
      message += ` - Error: ${data.error}`;
    }
    
    if (data.responseTime) {
      message += ` - Response time: ${data.responseTime}ms`;
    }
    
    this.info(message);
  }
}

// Export a singleton logger instance
module.exports = new Logger({
  logLevel: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : undefined,
  logToFile: process.env.LOG_TO_FILE === 'true',
  logFilePath: process.env.LOG_FILE_PATH
});