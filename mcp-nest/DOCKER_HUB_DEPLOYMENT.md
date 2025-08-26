# Docker Hub Deployment Guide

## 🐳 Complete Docker Hub Deployment Process

### Step 1: Build and Push to Docker Hub

```powershell
# Navigate to your project
cd "C:\Users\Gheorghe Valer\Documents\Projects\mcp\mcp-nest"

# Login to Docker Hub (you'll be prompted for username and password)
docker login

# Build the image with your Docker Hub username
docker build -t YOUR_DOCKERHUB_USERNAME/mcp:latest .

# Push to Docker Hub
docker push YOUR_DOCKERHUB_USERNAME/mcp:latest
```

### Step 2: Update Kubernetes Configuration

**Edit `k8s/deployment.yaml`** and replace `YOUR_DOCKERHUB_USERNAME` with your actual Docker Hub username:

```yaml
containers:
- name: mcp
  image: YOUR_DOCKERHUB_USERNAME/mcp:latest  # Replace with your username
  imagePullPolicy: Always
```

### Step 3: Deploy to RKE Cluster

```powershell
# Copy Kubernetes manifests to server
scp -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" -r k8s/ gvaler@192.168.88.71:~/mcp-deployment/

# Deploy to cluster
ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "
cd ~/mcp-deployment &&
kubectl apply -f namespace.yaml &&
kubectl apply -f configmap.yaml &&
kubectl apply -f deployment.yaml &&
kubectl apply -f service.yaml &&
kubectl apply -f ingress.yaml &&
echo '🚀 Deployment completed!' &&
kubectl get pods -n mcp &&
kubectl get svc -n mcp &&
kubectl get ingress -n mcp
"
```

### Step 4: Monitor Deployment

```powershell
# Check deployment status
ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "
kubectl get pods -n mcp -w
"

# Check logs if needed
ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "
kubectl logs -l app=mcp -n mcp
"
```

## 🔄 Complete One-Line Deployment

After pushing to Docker Hub, use this single command:

```powershell
scp -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" -r k8s/ gvaler@192.168.88.71:~/mcp/ && ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "cd ~/mcp && kubectl apply -f . && echo '✅ Deployed!' && kubectl get all -n mcp"
```

## 🔧 Updating Your Deployment

When you make changes:

```powershell
# 1. Rebuild and push
docker build -t YOUR_DOCKERHUB_USERNAME/mcp:latest .
docker push YOUR_DOCKERHUB_USERNAME/mcp:latest

# 2. Restart deployment to pull new image
ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "
kubectl rollout restart deployment mcp -n mcp &&
kubectl rollout status deployment mcp -n mcp
"
```

## 🌐 Access Your Application

Once deployed successfully:

- **Web Interface**: https://nest.open-hand.org
- **MCP Endpoint**: https://nest.open-hand.org/mcp
- **Health Check**: https://nest.open-hand.org (should show "Hello World!")

## 🔗 Claude Chat Configuration

```json
{
  "name": "SAP OData MCP Server",
  "description": "SAP OData access via MCP on Kubernetes",
  "url": "https://nest.open-hand.org/mcp",
  "transport": "streamable"
}
```

## ✅ Success Checklist

- [ ] Docker Hub account created
- [ ] Image built and pushed to Docker Hub  
- [ ] deployment.yaml updated with your Docker Hub username
- [ ] Kubernetes manifests copied to server
- [ ] Application deployed to cluster
- [ ] Pods running successfully
- [ ] Ingress configured and accessible
- [ ] SSL certificate issued
- [ ] Claude Chat connected successfully

## 🆘 Troubleshooting

**Image Pull Errors:**
```bash
# Make sure image exists on Docker Hub
docker pull YOUR_DOCKERHUB_USERNAME/mcp:latest

# Check if image is public or add imagePullSecrets if private
```

**Pod Not Starting:**
```bash
ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "
kubectl describe pod -l app=mcp -n mcp
kubectl logs -l app=mcp -n mcp
"
```

**Ingress Issues:**
```bash
ssh -i "C:\Users\Gheorghe Valer\.ssh\id_rsa" gvaler@192.168.88.71 "
kubectl describe ingress mcp-ingress -n mcp
kubectl get certificates -n mcp
"
```