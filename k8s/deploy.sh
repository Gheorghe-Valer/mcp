#!/bin/bash

# Kubernetes Deployment Script for MCP Server
# Usage: ./deploy.sh [build|deploy|delete|logs]

set -e

NAMESPACE="mcp"
APP_NAME="mcp"
IMAGE_NAME="mcp:latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

build_image() {
    log "Building Docker image..."
    cd ..
    docker build -t $IMAGE_NAME .
    log "Docker image built successfully: $IMAGE_NAME"
}

deploy() {
    log "Deploying MCP to Kubernetes..."
    
    # Apply namespace
    kubectl apply -f namespace.yaml
    
    # Apply ConfigMap and Secrets
    kubectl apply -f configmap.yaml
    
    # Apply Deployment
    kubectl apply -f deployment.yaml
    
    # Apply Service
    kubectl apply -f service.yaml
    
    # Apply Ingress (update domain first!)
    warn "Please update the domain in ingress.yaml before applying"
    read -p "Have you updated the domain in ingress.yaml? (y/N): " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        kubectl apply -f ingress.yaml
        log "Ingress applied"
    else
        warn "Skipping ingress deployment. Apply manually with: kubectl apply -f ingress.yaml"
    fi
    
    log "Deployment completed!"
    
    # Show status
    kubectl get pods -n $NAMESPACE
    kubectl get services -n $NAMESPACE
    kubectl get ingress -n $NAMESPACE
}

delete() {
    warn "Deleting MCP deployment..."
    kubectl delete -f ingress.yaml --ignore-not-found=true
    kubectl delete -f service.yaml --ignore-not-found=true
    kubectl delete -f deployment.yaml --ignore-not-found=true
    kubectl delete -f configmap.yaml --ignore-not-found=true
    kubectl delete -f namespace.yaml --ignore-not-found=true
    log "Deployment deleted"
}

logs() {
    log "Showing logs for MCP..."
    kubectl logs -f -l app=$APP_NAME -n $NAMESPACE
}

status() {
    log "Checking deployment status..."
    echo "Namespace:"
    kubectl get namespace $NAMESPACE 2>/dev/null || echo "Namespace not found"
    echo
    echo "Pods:"
    kubectl get pods -n $NAMESPACE 2>/dev/null || echo "No pods found"
    echo
    echo "Services:"
    kubectl get services -n $NAMESPACE 2>/dev/null || echo "No services found"
    echo
    echo "Ingress:"
    kubectl get ingress -n $NAMESPACE 2>/dev/null || echo "No ingress found"
}

case "${1:-help}" in
    build)
        build_image
        ;;
    deploy)
        deploy
        ;;
    delete)
        delete
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    help|*)
        echo "Usage: $0 {build|deploy|delete|logs|status}"
        echo ""
        echo "Commands:"
        echo "  build   - Build Docker image"
        echo "  deploy  - Deploy to Kubernetes"
        echo "  delete  - Delete deployment"
        echo "  logs    - Show application logs"
        echo "  status  - Show deployment status"
        exit 1
        ;;
esac