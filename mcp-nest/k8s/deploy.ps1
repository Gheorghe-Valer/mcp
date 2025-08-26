# PowerShell Deployment Script for MCP Server on RKE Cluster
# Usage: .\deploy.ps1 [build|deploy|delete|logs|status]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "deploy", "delete", "logs", "status", "help")]
    [string]$Action
)

# Configuration
$NAMESPACE = "mcp"
$APP_NAME = "mcp"
$IMAGE_NAME = "mcp"
$IMAGE_TAG = "latest"
$REGISTRY = ""  # Add your container registry here if using one (e.g., "your-registry.com/")

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Build-Image {
    Write-Info "Building Docker image..."
    
    # Navigate to project root
    Set-Location ..
    
    # Build Docker image
    $buildCommand = "docker build -t ${REGISTRY}${IMAGE_NAME}:${IMAGE_TAG} ."
    Write-Info "Running: $buildCommand"
    
    Invoke-Expression $buildCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Docker image built successfully: ${REGISTRY}${IMAGE_NAME}:${IMAGE_TAG}"
        
        # If using a registry, push the image
        if ($REGISTRY -ne "") {
            Write-Info "Pushing image to registry..."
            $pushCommand = "docker push ${REGISTRY}${IMAGE_NAME}:${IMAGE_TAG}"
            Write-Info "Running: $pushCommand"
            Invoke-Expression $pushCommand
            
            if ($LASTEXITCODE -eq 0) {
                Write-Info "Image pushed successfully"
            } else {
                Write-Error "Failed to push image"
                exit 1
            }
        }
    } else {
        Write-Error "Failed to build Docker image"
        exit 1
    }
    
    # Return to k8s directory
    Set-Location k8s
}

function Deploy-Application {
    Write-Info "Deploying MCP to Kubernetes..."
    
    # Check if kubectl is available
    try {
        kubectl version --client | Out-Null
    } catch {
        Write-Error "kubectl not found. Please install kubectl and configure access to your RKE cluster"
        exit 1
    }
    
    # Apply namespace
    Write-Info "Creating namespace..."
    kubectl apply -f namespace.yaml
    
    # Apply ConfigMap and Secrets
    Write-Info "Applying ConfigMap and Secrets..."
    kubectl apply -f configmap.yaml
    
    # Apply Deployment
    Write-Info "Deploying application..."
    kubectl apply -f deployment.yaml
    
    # Apply Service
    Write-Info "Creating service..."
    kubectl apply -f service.yaml
    
    # Apply Ingress
    Write-Info "Creating ingress..."
    kubectl apply -f ingress.yaml
    
    Write-Info "Deployment completed!"
    
    # Show status
    Write-Info "Current deployment status:"
    kubectl get pods -n $NAMESPACE
    kubectl get services -n $NAMESPACE
    kubectl get ingress -n $NAMESPACE
    
    # Wait for pods to be ready
    Write-Info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=$APP_NAME -n $NAMESPACE --timeout=300s
    
    Write-Info "🚀 MCP Server is now deployed and accessible at: https://nest.open-hand.org"
}

function Delete-Deployment {
    Write-Warn "Deleting MCP deployment..."
    
    $confirmation = Read-Host "Are you sure you want to delete the deployment? (y/N)"
    if ($confirmation -eq "y" -or $confirmation -eq "Y") {
        kubectl delete -f ingress.yaml --ignore-not-found=true
        kubectl delete -f service.yaml --ignore-not-found=true
        kubectl delete -f deployment.yaml --ignore-not-found=true
        kubectl delete -f configmap.yaml --ignore-not-found=true
        kubectl delete -f namespace.yaml --ignore-not-found=true
        Write-Info "Deployment deleted"
    } else {
        Write-Info "Deletion cancelled"
    }
}

function Show-Logs {
    Write-Info "Showing logs for MCP..."
    kubectl logs -f -l app=$APP_NAME -n $NAMESPACE
}

function Show-Status {
    Write-Info "Checking deployment status..."
    
    Write-Host "`nNamespace:" -ForegroundColor Cyan
    try {
        kubectl get namespace $NAMESPACE
    } catch {
        Write-Host "Namespace not found" -ForegroundColor Red
    }
    
    Write-Host "`nPods:" -ForegroundColor Cyan
    try {
        kubectl get pods -n $NAMESPACE
    } catch {
        Write-Host "No pods found" -ForegroundColor Red
    }
    
    Write-Host "`nServices:" -ForegroundColor Cyan
    try {
        kubectl get services -n $NAMESPACE
    } catch {
        Write-Host "No services found" -ForegroundColor Red
    }
    
    Write-Host "`nIngress:" -ForegroundColor Cyan
    try {
        kubectl get ingress -n $NAMESPACE
    } catch {
        Write-Host "No ingress found" -ForegroundColor Red
    }
    
    Write-Host "`nCertificates:" -ForegroundColor Cyan
    try {
        kubectl get certificates -n $NAMESPACE
    } catch {
        Write-Host "No certificates found" -ForegroundColor Red
    }
}

function Show-Help {
    Write-Host @"
Usage: .\deploy.ps1 [build|deploy|delete|logs|status]

Commands:
  build   - Build Docker image (and push if registry configured)
  deploy  - Deploy to Kubernetes cluster
  delete  - Delete deployment from cluster
  logs    - Show application logs
  status  - Show deployment status

Prerequisites:
  - Docker installed and running
  - kubectl configured for your RKE cluster
  - Container registry access (if using external registry)

Examples:
  .\deploy.ps1 build
  .\deploy.ps1 deploy
  .\deploy.ps1 status
  .\deploy.ps1 logs
"@
}

# Main execution
switch ($Action) {
    "build" { Build-Image }
    "deploy" { Deploy-Application }
    "delete" { Delete-Deployment }
    "logs" { Show-Logs }
    "status" { Show-Status }
    "help" { Show-Help }
    default { Show-Help }
}