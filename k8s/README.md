# MCP Nest Server Kubernetes Manifests

This directory contains the Kubernetes deployment manifests for the MCP Nest Server.

## Files:
- `deployment.yaml` - Application deployment
- `service.yaml` - Kubernetes service  
- `configmap.yaml` - Configuration and secrets
- `ingress.yaml` - Ingress configuration for nest.open-hand.org

## Fleet Configuration:
Configure Fleet in Rancher UI to monitor this directory:
- Repository: https://github.com/Gheorghe-Valer/mcp.git
- Branch: main
- Path: k8s/
- Namespace: mcp-production