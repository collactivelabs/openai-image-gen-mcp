# Contributing to OpenAI Image Generation MCP

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Project Structure](#project-structure)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/openai-image-gen-mcp.git`
3. Add upstream remote: `git remote add upstream https://github.com/originalowner/openai-image-gen-mcp.git`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js v14.0.0 or higher
- npm or yarn
- OpenAI API key (for testing)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your OpenAI API key to .env
echo "OPENAI_API_KEY=your-key-here" >> .env
```

### Running Locally

```bash
# Run MCP server (for Claude Desktop)
npm start

# Run HTTP server (for REST API)
npm run start:http

# Run in development mode with auto-reload
npm run dev
```

## Making Changes

### Branch Naming

- Feature: `feature/description`
- Bug fix: `fix/description`
- Documentation: `docs/description`
- Refactoring: `refactor/description`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(validation): add input validation for image parameters

Implements comprehensive validation for all DALL-E parameters
including model-specific constraints.

Closes #123
```

```
fix(auth): prevent timing attacks in token comparison

Use crypto.timingSafeEqual for constant-time string comparison
to prevent timing-based attacks on authentication tokens.
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in the `tests/` directory
- Name test files with `.test.js` suffix
- Use Jest for testing framework
- Mock external dependencies (OpenAI API, file system, etc.)
- Aim for high test coverage (>80%)

**Example test structure:**
```javascript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  describe('methodName', () => {
    it('should do something specific', () => {
      // Test implementation
    });

    it('should handle error cases', () => {
      // Error handling test
    });
  });
});
```

## Pull Request Process

1. **Update your branch with upstream changes:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all tests pass:**
   ```bash
   npm test
   ```

3. **Update documentation:**
   - Update README.md if adding features
   - Update CHANGELOG.md with your changes
   - Add JSDoc comments to new functions

4. **Create a pull request:**
   - Use a clear, descriptive title
   - Reference related issues
   - Provide a detailed description of changes
   - Include screenshots for UI changes

5. **Address review feedback:**
   - Make requested changes
   - Push additional commits
   - Respond to comments

6. **Squash commits (if requested):**
   ```bash
   git rebase -i HEAD~n  # n = number of commits
   ```

## Coding Standards

### JavaScript Style

- Use ES6+ features
- Use `const` by default, `let` when reassignment is needed
- Avoid `var`
- Use async/await for asynchronous code
- Use arrow functions for callbacks
- Use template literals for string interpolation

### Code Organization

- Keep functions small and focused
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Group related functionality into modules
- Avoid deep nesting (max 3 levels)

### Error Handling

- Always handle errors explicitly
- Use try/catch for async operations
- Log errors with appropriate context
- Return meaningful error messages
- Don't expose internal implementation details in errors

### Example Code Style

```javascript
/**
 * Generate an image using OpenAI's DALL-E
 * @param {string} prompt - Image description
 * @param {Object} options - Generation options
 * @param {string} options.model - Model to use (dall-e-2 or dall-e-3)
 * @param {string} options.size - Image size
 * @returns {Promise<Object>} Generated image data
 * @throws {ValidationError} If parameters are invalid
 */
async function generateImage(prompt, options = {}) {
  try {
    // Validate inputs
    const validatedParams = validateParams({ prompt, ...options });

    // Make API call
    const response = await openai.images.generate(validatedParams);

    return response.data;
  } catch (error) {
    logger.error('Image generation failed:', error);
    throw new GenerationError('Failed to generate image', error);
  }
}
```

## Project Structure

```
openai-image-gen-mcp/
├── src/
│   ├── index.js                 # HTTP server entry point
│   ├── mcp-server.js           # MCP server entry point
│   ├── openai-image-gen.js     # Core image generation logic
│   ├── middleware/             # Express middleware
│   │   ├── auth.js             # Authentication
│   │   └── rate-limit.js       # Rate limiting
│   └── utils/                  # Utility modules
│       ├── config.js           # Configuration management
│       ├── validation.js       # Input validation
│       ├── logger.js           # Logging utility
│       ├── image-cleanup.js    # Image cleanup utility
│       └── metrics.js          # Metrics collection
├── tests/                      # Test files
├── public/                     # Static web files
├── docs/                       # Documentation
├── .env.example               # Environment template
├── package.json               # Dependencies
├── README.md                  # Main documentation
├── CHANGELOG.md               # Change history
└── CONTRIBUTING.md            # This file
```

## Questions or Issues?

- **Bug reports:** Open an issue with the `bug` label
- **Feature requests:** Open an issue with the `enhancement` label
- **Questions:** Open an issue with the `question` label
- **Security issues:** Email security@example.com (do not open public issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to OpenAI Image Generation MCP! 🎉
