#!/bin/bash

# Build and push script for MCP NestJS server
set -e

# Configuration
DOCKER_USERNAME="gvaler"
IMAGE_NAME="mcp-nest-server"
VERSION=${1:-latest}

echo "Building Docker image..."
docker build -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} .

echo "Tagging as latest..."
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo "Pushing to Docker Hub..."
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo "Image pushed successfully!"
echo "Docker image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo "Latest tag: ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"

# Update Kubernetes deployment
echo "Updating Kubernetes deployment..."
kubectl set image deployment/mcp-nest-server mcp-nest-server=${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
kubectl rollout status deployment/mcp-nest-server

echo "Deployment completed successfully!"