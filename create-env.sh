#!/bin/bash

# Script to create .env file from .env.example

# Check if .env already exists
if [ -f .env ]; then
  echo "Warning: .env file already exists."
  read -p "Overwrite? (y/n): " overwrite
  
  if [ "$overwrite" != "y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# Copy the example file
cp .env.example .env

# Get OpenAI API key
read -p "Enter your OpenAI API key: " api_key
sed -i '' "s|your_openai_api_key_here|$api_key|g" .env

# Get auth token or generate one
read -p "Enter an authentication token or press enter to generate one: " auth_token

if [ -z "$auth_token" ]; then
  # Generate a random token
  if command -v openssl &> /dev/null; then
    auth_token=$(openssl rand -hex 32)
  else
    auth_token=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
  fi
  echo "Generated token: $auth_token"
fi

sed -i '' "s|your_secure_auth_token_here|$auth_token|g" .env

# Set port if needed
read -p "Enter server port (press enter for default 3000): " port

if [ ! -z "$port" ]; then
  sed -i '' "s|PORT=3000|PORT=$port|g" .env
fi

echo ".env file created successfully."