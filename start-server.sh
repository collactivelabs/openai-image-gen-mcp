#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please run ./create-env.sh first."
  exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Source the environment variables
export $(grep -v '^#' .env | xargs)

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY not set in .env file."
  exit 1
fi

# Start the server
echo "Starting OpenAI Image Generation MCP server..."
npm start