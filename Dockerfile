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

# Start the service
CMD ["npm", "start"]