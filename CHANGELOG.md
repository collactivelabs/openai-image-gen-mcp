# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive input validation for all image generation parameters
- Rate limiting middleware for HTTP endpoints (configurable per IP/token)
- API key validation on server startup with OpenAI API verification
- Image cleanup mechanism with automatic scheduling
  - Configurable retention period (default: 7 days)
  - Maximum file count limit
  - Manual and automatic cleanup modes
  - Dry-run support for testing
- Metrics and monitoring endpoints
  - Prometheus-compatible `/metrics` endpoint
  - JSON metrics at `/admin/metrics`
  - Request/response tracking
  - Image generation metrics
  - System metrics (memory, uptime)
- Admin endpoints for image management
  - `GET /admin/images/stats` - View image statistics
  - `POST /admin/images/cleanup` - Manually trigger cleanup
- Configuration validation utility with environment variable management
- Comprehensive test suites (80+ tests)
  - Auth middleware tests
  - Validation utility tests
  - Configuration utility tests
- Enhanced error handling with timeouts for HTTPS downloads (30s)
- Async file operations throughout the codebase

### Changed
- Refactored MCP server to use shared OpenAIImageGenMCP class (eliminates code duplication)
- Standardized logging across all modules using centralized logger
- Improved authentication with timing-attack resistant token comparison
- Enhanced HTTP download error handling with proper cleanup
- Better startup logging with available endpoint information

### Fixed
- Timing attack vulnerability in authentication middleware
- Synchronous file operations blocking event loop
- Missing error handling in image download process
- Incomplete cleanup of failed file downloads

### Security
- Fixed timing attack vulnerability using `crypto.timingSafeEqual`
- Added comprehensive input validation to prevent injection attacks
- Implemented rate limiting to prevent abuse
- Added API key format validation
- Improved error messages without exposing internal details

## [1.0.0] - 2024-10-23

### Added
- Initial release with MCP server for Claude Desktop
- HTTP REST API server for general use
- Support for DALL-E 2 and DALL-E 3 models
- Configurable image generation parameters (size, quality, style)
- Local image saving with fallback directories
- Web UI for testing
- Docker support with docker-compose
- Bearer token authentication for HTTP API
- Configurable logging system
- Basic test suite

### Features
- Generate images with OpenAI DALL-E models
- MCP protocol compliance for Claude Desktop integration
- HTTP REST API with Express.js
- Image serving via static file endpoint
- Health check endpoint
- Environment-based configuration

[Unreleased]: https://github.com/yourusername/openai-image-gen-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/openai-image-gen-mcp/releases/tag/v1.0.0
