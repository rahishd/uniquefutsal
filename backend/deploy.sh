#!/bin/bash

# Exit immediately if any command fails
set -e

echo "Starting deployment..."

# Pull latest code
git pull

# Install/update dependencies
npm install

# Build the project
npm run build

# Restart PM2 processes
pm2 restart all

echo "Deployment completed successfully!"