FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source code
COPY . .

# Create volume mount point for generated images
RUN mkdir -p /app/generated-images
VOLUME /app/generated-images

# Expose the port
EXPOSE 3010

# Create a script to start the service
RUN echo '#!/bin/bash\nnode src/mcp-server.js' > /app/start-service.sh && \
    chmod +x /app/start-service.sh

# Start the service
CMD ["/app/start-service.sh"]