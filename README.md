# MCP NestJS Server for SAP OData Integration

A Model Context Protocol (MCP) server built with NestJS that provides SAP OData integration capabilities. This server enables AI assistants and applications to interact with SAP systems through standardized OData APIs.

## 🚀 Features

- **MCP Protocol Support**: Full integration with the Model Context Protocol
- **SAP OData Integration**: Connect to and query SAP OData services
- **Service Discovery**: Automatic discovery of available SAP services
- **Metadata Parsing**: Extract and parse SAP service metadata
- **CSRF Token Support**: Automatic CSRF token handling for SAP authentication
- **SSL/TLS Support**: HTTPS support with self-signed certificates for development
- **CORS Enabled**: Cross-origin support for web applications
- **Docker Support**: Containerized deployment with Docker and Kubernetes
- **Health Monitoring**: Built-in health check endpoints

## 🏗️ Architecture

### Core Components

- **MCP Resolver** (`src/mcp/mcp.resolver.ts`): Main MCP protocol handler
- **OData Client Service** (`src/mcp/services/odata-client.service.ts`): SAP OData integration logic
- **OData Resolver** (`src/mcp/resolvers/odata.resolver.ts`): OData-specific MCP tools
- **Main Application** (`src/main.ts`): NestJS application bootstrap with HTTPS support

### Key Features

1. **Connection Management**: Robust connection handling with retry logic
2. **Service Discovery**: Automatic detection of available SAP OData services
3. **Metadata Extraction**: Parse and expose SAP service metadata
4. **Query Support**: Execute OData queries with filtering, sorting, and pagination
5. **Authentication**: Support for basic authentication and CSRF tokens

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- SAP system with OData services enabled
- SSL certificates (for HTTPS development mode)

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Gheorghe-Valer/mcp.git
   cd mcp/mcp-nest
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Configure your SAP connection settings in `.env`:
   ```env
   # SAP Connection Settings
   SAP_BASE_URL=https://your-sap-server:8000
   SAP_USERNAME=your-username
   SAP_PASSWORD=your-password
   SAP_CLIENT=100
   SAP_TIMEOUT=30000
   SAP_VALIDATE_SSL=false
   SAP_ENABLE_CSRF=true
   
   # Server Settings
   PORT=3000
   NODE_ENV=development
   ```

4. **SSL Certificates (Development)**
   
   Generate self-signed certificates for HTTPS development:
   ```bash
   # Create certificates directory
   mkdir -p certs
   
   # Generate certificates (see CERTIFICATE_SETUP.md for detailed instructions)
   cd certs
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

## 🚀 Usage

### Development Mode

Start the server in development mode with auto-reload:

```bash
npm run start:dev
```

The server will be available at:
- **HTTPS**: `https://localhost:3000` (with certificates)
- **HTTP**: `http://localhost:3000` (fallback)

### Production Mode

Build and run in production mode:

```bash
npm run build
npm run start:prod
```

### Testing

Run the test suite:

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🔧 MCP Tools Available

The server exposes the following MCP tools:

### Server Management Tools

- **`server_health_check`**: Check server operational status
- **`get_server_info`**: Get server information and version

### SAP OData Tools

- **`sap_connect`**: Establish connection to SAP OData services
- **`sap_get_connection_info`**: Get current connection status and details
- **`sap_disconnect`**: Disconnect from SAP services
- **`sap_get_services`**: Discover available OData services
- **`sap_get_service_metadata`**: Get metadata for a specific service
- **`sap_query_entity_set`**: Query OData entity sets with filters and options

### Example Usage

```typescript
// Connect to SAP
await sap_connect();

// Get available services
const services = await sap_get_services();

// Get service metadata
const metadata = await sap_get_service_metadata("API_BUSINESS_PARTNER");

// Query entity set
const partners = await sap_query_entity_set(
  "API_BUSINESS_PARTNER", 
  "A_BusinessPartner",
  {
    select: ["BusinessPartner", "BusinessPartnerName"],
    filter: "BusinessPartnerName eq 'ACME Corp'",
    top: 10
  }
);
```

## 🐳 Docker Deployment

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t mcp-nest-server .

# Run the container
docker run -p 3000:3000 --env-file .env mcp-nest-server
```

### Using Docker Compose

```bash
# Start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## ☸️ Kubernetes Deployment

Deploy to Kubernetes cluster:

```bash
# Apply Kubernetes configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=mcp-nest-server

# View logs
kubectl logs -l app=mcp-nest-server -f
```

The Kubernetes deployment includes:
- Deployment with auto-scaling
- Service for internal communication
- Ingress for external access
- ConfigMap for environment variables

## 📊 Monitoring and Health Checks

### Health Check Endpoints

- **Health Check**: `GET /health` - Basic health status
- **MCP Health**: Use the `server_health_check` MCP tool

### Logging

The server provides comprehensive logging:
- Connection attempts and status
- OData service discovery
- Query execution details
- Error tracking and debugging

## 🔒 Security Considerations

1. **SSL/TLS**: Always use HTTPS in production
2. **Authentication**: Secure your SAP credentials
3. **CORS**: Configure CORS settings for your domain
4. **Environment Variables**: Never commit sensitive data to version control
5. **Network Security**: Ensure proper firewall and network configuration

## 🛠️ Troubleshooting

### Common Issues

1. **SSL Certificate Errors**
   - Check certificate paths and validity
   - Verify certificate matches hostname
   - See `CERTIFICATE_FIX.md` for detailed solutions

2. **SAP Connection Issues**
   - Verify SAP server accessibility
   - Check authentication credentials
   - Ensure OData services are activated in SAP
   - Review network connectivity and firewall settings

3. **CSRF Token Issues**
   - Verify `SAP_ENABLE_CSRF` setting
   - Check SAP system CSRF requirements
   - Review authentication flow

For detailed troubleshooting steps, see `TROUBLESHOOTING.md`.

## 📚 Documentation

Additional documentation is available in the `mcp-nest/` directory:

- `CERTIFICATE_SETUP.md` - SSL certificate configuration
- `CERTIFICATE_FIX.md` - Certificate troubleshooting
- `DOCKER_HUB_DEPLOYMENT.md` - Docker Hub deployment guide
- `KUBERNETES_DEPLOYMENT.md` - Kubernetes deployment details
- `WINDOWS_DEPLOYMENT.md` - Windows-specific deployment
- `TROUBLESHOOTING.md` - Comprehensive troubleshooting guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the UNLICENSED license. See the `package.json` file for details.

## 🙋‍♂️ Support

For support and questions:
- Create an issue in the GitHub repository
- Review the troubleshooting documentation
- Check the existing issues for similar problems

## 🔄 Version History

- **v0.0.1** - Initial release with basic MCP and SAP OData integration
- Features: Connection management, service discovery, metadata parsing, query execution

---

**Built with** ❤️ **using NestJS and the Model Context Protocol**