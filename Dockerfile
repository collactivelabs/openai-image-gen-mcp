# Build stage - for dependencies and testing
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code and tests
COPY . .

# Run tests (optional - comment out if you want to skip)
# Uncomment the next line to run tests during build:
# RUN npm test

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy app source from builder
COPY --from=builder /app/src ./src

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/generated-images && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Create volume mount point for generated images
VOLUME /app/generated-images

# Expose the port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the service directly with node
CMD ["node", "src/mcp-server.js"]