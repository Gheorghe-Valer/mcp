# Windows Deployment Guide - MCP Server to RKE Cluster

## 🖥️ Prerequisites

### 1. Install Required Tools

**Docker Desktop for Windows:**
```powershell
# Download from https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
# Or via Chocolatey:
choco install docker-desktop
```

**kubectl for Windows:**
```powershell
# Via Chocolatey:
choco install kubernetes-cli

# Or via PowerShell:
curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
```

**Optional - Helm (for advanced deployments):**
```powershell
choco install kubernetes-helm
```

### 2. Configure RKE Cluster Access

**Get your kubeconfig from Rancher:**
1. Login to your Rancher UI
2. Go to your RKE cluster
3. Click "Kubeconfig File" 
4. Copy the content to `~\.kube\config`

**Test cluster connection:**
```powershell
kubectl cluster-info
kubectl get nodes
```

## 🚀 Deployment Steps

### Step 1: Build Docker Image

```powershell
# Navigate to project directory
cd "C:\Users\Gheorghe Valer\Documents\Projects\mcp\mcp-nest"

# Navigate to k8s directory
cd k8s

# Build the Docker image
.\deploy.ps1 build
```

### Step 2: Deploy to Kubernetes

```powershell
# Deploy the complete application
.\deploy.ps1 deploy
```

### Step 3: Monitor Deployment

```powershell
# Check deployment status
.\deploy.ps1 status

# Watch logs
.\deploy.ps1 logs
```

## 🐳 Using Container Registry (Recommended)

If your RKE cluster can't access images built locally, push to a registry:

### Option 1: Docker Hub
```powershell
# Login to Docker Hub
docker login

# Tag image for Docker Hub
docker tag mcp:latest yourusername/mcp:latest

# Push to Docker Hub
docker push yourusername/mcp:latest
```

### Option 2: Private Registry
```powershell
# Tag for private registry
docker tag mcp:latest your-registry.com/mcp:latest

# Push to private registry
docker push your-registry.com/mcp:latest
```

**Update deployment.yaml:**
```yaml
# Edit k8s/deployment.yaml
spec:
  containers:
  - name: mcp
    image: yourusername/mcp:latest  # or your-registry.com/mcp:latest
```

## 🔧 Manual Deployment Commands

If you prefer manual deployment:

```powershell
# Build image
docker build -t mcp:latest .

# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Check status
kubectl get all -n mcp
```

## 🌐 DNS Configuration

For `nest.open-hand.org` to work, you need:

### Option 1: Public DNS (Recommended)
1. Add A record: `nest.open-hand.org` → Your RKE cluster external IP
2. Certificate will be auto-generated via Let's Encrypt

### Option 2: Local DNS (Testing)
```powershell
# Edit hosts file as Administrator
notepad C:\Windows\System32\drivers\etc\hosts

# Add line:
YOUR_CLUSTER_IP nest.open-hand.org
```

## 🔍 Troubleshooting

### Common Issues:

**1. Image Pull Errors:**
```powershell
# Check if image exists
docker images | findstr mcp

# Push to accessible registry
docker tag mcp:latest yourusername/mcp:latest
docker push yourusername/mcp:latest
```

**2. kubectl Not Connected:**
```powershell
# Test connection
kubectl cluster-info

# Check config
kubectl config current-context
kubectl config get-contexts
```

**3. Ingress Not Working:**
```powershell
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress status
kubectl describe ingress mcp-ingress -n mcp
```

**4. Certificate Issues:**
```powershell
# Check cert-manager (if installed)
kubectl get certificates -n mcp
kubectl describe certificate mcp-tls -n mcp

# Check certificate issuer
kubectl get clusterissuer
```

### Debugging Commands:

```powershell
# Pod logs
kubectl logs -l app=mcp -n mcp

# Pod description
kubectl describe pod -l app=mcp -n mcp

# Service endpoints
kubectl get endpoints -n mcp

# Ingress details
kubectl describe ingress mcp-ingress -n mcp

# Test service directly
kubectl port-forward svc/mcp-service 8080:80 -n mcp
# Then open http://localhost:8080
```

## 🔄 Update Deployment

To update your deployment:

```powershell
# Rebuild image
.\deploy.ps1 build

# If using registry, the new image will be pushed automatically
# Force pod restart to pull new image
kubectl rollout restart deployment mcp -n mcp

# Watch rollout
kubectl rollout status deployment mcp -n mcp
```

## 🗑️ Cleanup

To remove the deployment:

```powershell
.\deploy.ps1 delete
```

## 📋 Final Checklist

- ✅ Docker Desktop running
- ✅ kubectl configured for RKE cluster  
- ✅ Container registry access (if needed)
- ✅ DNS configured for mcp.open-hand.org
- ✅ cert-manager installed in cluster (for SSL)
- ✅ nginx-ingress controller installed

## 🎯 Success Indicators

Your deployment is successful when:

1. **Pods Running:** `kubectl get pods -n mcp` shows "Running" status
2. **Service Available:** `kubectl get svc -n mcp` shows ClusterIP assigned  
3. **Ingress Ready:** `kubectl get ingress -n mcp` shows ADDRESS assigned
4. **Certificate Valid:** `kubectl get certificates -n mcp` shows "True" status
5. **External Access:** `https://nest.open-hand.org` responds without SSL errors

## 🔗 Claude Chat Configuration

Once deployed successfully, use this in Claude Chat:

```json
{
  "name": "SAP OData MCP Server",
  "description": "SAP OData access via MCP on Kubernetes",
  "url": "https://nest.open-hand.org/mcp",
  "transport": "streamable"
}
```