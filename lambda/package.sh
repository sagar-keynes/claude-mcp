#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Building Lambda packages..."

# 1. Build the Function Zip
echo "Packaging function into function.zip..."
rm -f function.zip
zip -q function.zip index.mjs

# 2. Build the Layer Zip
echo "Packaging dependencies into layer.zip..."
rm -f layer.zip
rm -rf nodejs
mkdir -p nodejs

# Copy package files
cp package.json nodejs/
cp package-lock.json nodejs/ 2>/dev/null || true

# Install production dependencies only
cd nodejs
echo "Installing production dependencies..."
npm install --production --silent
cd ..

# Zip the nodejs folder (required structure for Lambda Layers)
zip -qr layer.zip nodejs

# Clean up temporary folder
rm -rf nodejs

echo "Done! Generated function.zip and layer.zip"
