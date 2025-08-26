# Kubernetes Deployment Guide for MCP Server

## 🚀 Overview

This guide will help you deploy the MCP Server to your Kubernetes Rancher RKE cluster, which will automatically provide:
- ✅ Proper SSL certificates via cert-manager/Let's Encrypt
- ✅ Load balancing and high availability
- ✅ Automatic scaling
- ✅ No more localhost certificate issues!

## 📋 Prerequisites

1. **Rancher RKE cluster** with kubectl access
2. **Docker** installed locally
3. **nginx-ingress** controller installed in cluster
4. **cert-manager** for automatic SSL certificates (recommended)
5. **Domain name** pointing to your cluster

## 🔧 Setup Steps

### 1. Update Configuration

The ingress is already configured for `mcp.open-hand.org`. If you need to change it, edit `k8s/ingress.yaml`:

```yaml
# Already configured:
- host: mcp.open-hand.org
```

### 2. Build and Deploy

```bash
# Navigate to k8s directory
cd k8s

# Make deploy script executable
chmod +x deploy.sh

# Build Docker image
./deploy.sh build

# Deploy to Kubernetes
./deploy.sh deploy
```

### 3. Alternative Manual Deployment

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f configmap.yaml

# Deploy application
kubectl apply -f deployment.yaml

# Create service
kubectl apply -f service.yaml

# Create ingress (after updating domain)
kubectl apply -f ingress.yaml
```

## 🏗️ Architecture

```
Internet → Ingress (SSL) → Service → Pods (2 replicas)
         ↓
    Let's Encrypt Certificate
```

- **2 Pod replicas** for high availability
- **Load balancing** across pods
- **SSL termination** at ingress level
- **Automatic certificate** management

## 🔍 Monitoring & Troubleshooting

### Check Deployment Status
```bash
./deploy.sh status
```

### View Logs
```bash
./deploy.sh logs
```

### Manual Checks
```bash
# Check pods
kubectl get pods -n mcp

# Check services
kubectl get services -n mcp

# Check ingress
kubectl get ingress -n mcp

# Describe pod for issues
kubectl describe pod -l app=mcp -n mcp
```

### Common Issues

1. **Image Pull Error**: Make sure Docker image is built and available
2. **Ingress Not Working**: Check nginx-ingress controller is installed
3. **Certificate Issues**: Verify cert-manager is configured
4. **DNS Issues**: Ensure domain points to cluster IP

## 🌐 Claude Chat Configuration

Once deployed, use this configuration in Claude Chat:

```json
{
  "name": "SAP OData MCP Server",
  "description": "SAP OData access via MCP on Kubernetes",
  "url": "https://nest.open-hand.org/mcp",
  "transport": "streamable"
}
```

## 📊 Resource Usage

- **CPU**: 100m request, 500m limit per pod
- **Memory**: 256Mi request, 512Mi limit per pod
- **Replicas**: 2 (can be scaled)

## 🔄 Scaling

To scale the deployment:

```bash
kubectl scale deployment mcp --replicas=3 -n mcp
```

## 🗑️ Cleanup

To remove the deployment:

```bash
./deploy.sh delete
```

## 🔒 Security Features

- ✅ Non-root container user
- ✅ Read-only root filesystem
- ✅ Security contexts applied
- ✅ Secrets for sensitive data
- ✅ Resource limits
- ✅ Network policies ready

## 📈 Next Steps

1. **Monitor**: Set up monitoring with Prometheus/Grafana
2. **Logging**: Configure centralized logging
3. **Backup**: Regular backups of ConfigMaps/Secrets
4. **Updates**: CI/CD pipeline for automated deployments

## 🆘 Support

If you encounter issues:

1. Check pod logs: `kubectl logs -l app=mcp -n mcp`
2. Verify ingress: `kubectl describe ingress mcp-ingress -n mcp`
3. Check certificate: `kubectl get certificate -n mcp`
4. Test service: `kubectl port-forward svc/mcp-service 8080:80 -n mcp`