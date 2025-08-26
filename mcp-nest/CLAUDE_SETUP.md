# Claude Chat MCP Custom Connector Setup

## Server Information
Your SAP OData MCP Server is running on:
- **URL**: `https://localhost:3000`
- **MCP Streamable Endpoint**: `https://localhost:3000/mcp`
- **MCP SSE Endpoint**: `https://localhost:3000/sse`

## Setting Up Custom Connector in Claude Chat

### Step 1: Access Claude Chat Settings
1. Go to [Claude Chat](https://claude.ai)
2. Click on your profile/settings icon
3. Navigate to "Connectors" or "Custom Connectors" section

### Step 2: Add New MCP Server
1. Click "Add Custom Server" or "New Connector"
2. Configure with the following settings:

**Basic Configuration:**
- **Name**: `SAP OData MCP Server`
- **Description**: `Access SAP OData services through MCP protocol`
- **Server URL**: `https://localhost:3000/mcp`
- **Transport**: `Streamable HTTP` (recommended) or `SSE`

**Advanced Settings:**
- **SSL Certificate Verification**: `Disabled` (for self-signed certificates)
- **Connection Timeout**: `30000ms`
- **Authentication**: `None` (handled internally by the server)

### Step 3: Certificate Trust (Important!)
Since we're using self-signed certificates, you may need to:

1. **Browser Trust**: Navigate to `https://localhost:3000` in your browser and accept the certificate warning
2. **System Trust** (Optional): Add the certificate to your system's trusted certificates:
   - Certificate Location: `C:\Users\Gheorghe Valer\Documents\Projects\mcp\mcp-nest\certs\cert.pem`

### Step 4: Test Connection
1. Save the connector configuration
2. Claude Chat should attempt to connect to your MCP server
3. If successful, you'll see the available tools listed

## Available MCP Tools

Once connected, Claude Chat will have access to these SAP OData tools:

### 🔌 Connection Management
- **`sap_connect`** - Connect to SAP OData service
- **`sap_connection_status`** - Check connection status
- **`sap_disconnect`** - Disconnect from SAP service

### 🔍 Service Discovery
- **`sap_get_services`** - List available OData services
- **`sap_get_service_metadata`** - Get service metadata (entities, properties)

### 📊 Data Access  
- **`sap_query_entity_set`** - Query entity sets with filtering/paging

### 💡 Server Utils
- **`server_health_check`** - Check MCP server health
- **`get_server_info`** - Get server information

## Usage Examples

### Basic Workflow in Claude Chat:
1. **Connect**: "Use sap_connect to connect to the SAP system"
2. **Discover**: "Use sap_get_services to show me available services"
3. **Explore**: "Use sap_get_service_metadata with service name 'API_BUSINESS_PARTNER'"
4. **Query**: "Use sap_query_entity_set to get business partners with filter 'BusinessPartnerType eq '1'''"

## Troubleshooting

### Connection Issues:
- Ensure the NestJS server is running (`npm run start:dev`)
- Check that port 3000 is not blocked by firewall
- Verify HTTPS certificate is trusted in browser

### SSL Certificate Issues:
- Navigate to `https://localhost:3000` and accept certificate
- Consider using HTTP for testing (change main.ts configuration)

### SAP Connection Issues:
- Verify SAP credentials in `.env` file
- Check SAP server accessibility
- Use `sap_connection_status` tool to debug

## Server Logs
Monitor server logs for debugging:
- Connection attempts appear in console
- Tool executions are logged
- SAP authentication issues are reported

## Security Note
This setup uses self-signed certificates for development. For production:
1. Use proper SSL certificates
2. Implement authentication
3. Restrict CORS origins
4. Use environment-specific configurations