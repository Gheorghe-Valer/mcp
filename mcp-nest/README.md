# Universal OData MCP Server

A powerful Model Context Protocol (MCP) server that provides dynamic access to OData services with multiple authentication methods. Built with NestJS and TypeScript, this server automatically discovers OData services, parses metadata, and generates tools for seamless interaction with any OData endpoint.

## Features

### 🌐 Universal OData Support
- **Multiple Authentication Types**: None, Basic Authentication, OAuth 2.0
- **OData Version Support**: Automatic detection and handling of OData v2, v3, and v4
- **System Types**: SAP On-Premise, SAP BTP, and Generic OData services

### 🔧 Dynamic Tool Generation
- **Metadata-Driven**: Automatically generates tools based on OData service metadata
- **Entity Operations**: Filter, Get, Create, Update, Delete, Search, Count for each entity set
- **Function Imports**: Supports OData function imports and actions
- **Flexible Naming**: Configurable tool naming with prefix/postfix patterns

### 🔐 Security & Authentication
- **OAuth 2.0**: Full client credentials flow with automatic token management and caching
- **Basic Authentication**: Username/password with optional SAP client support
- **CSRF Protection**: Automatic CSRF token handling for SAP systems
- **SSL/TLS**: Configurable SSL validation

### 📊 Advanced Query Features
- **OData Query Options**: Full support for $filter, $select, $expand, $orderby, $top, $skip, $count, $search
- **Response Enhancement**: Automatic pagination, count extraction, and data normalization
- **Version Translation**: Automatic parameter translation between OData versions

## Installation

```bash
npm install
```

## Configuration

Configure your OData systems using environment variables. Create a `.env` file in the root directory:

### Basic Configuration

```env
# Legacy SAP System (Basic Auth)
SAP_BASE_URL=https://your-sap-system.com/sap/opu/odata
SAP_USERNAME=your-username
SAP_PASSWORD=your-password
SAP_CLIENT=100
SAP_VALIDATE_SSL=false
SAP_ENABLE_CSRF=true

# SAP BTP Catalog Service (OAuth 2.0)
CATALOG_ODATA_URL=https://your-tenant.cfapps.region.hana.ondemand.com/catalog/api/v1
CATALOG_OAUTH_TOKEN_URL=https://your-tenant.authentication.region.hana.ondemand.com/oauth/token
CATALOG_OAUTH_CLIENT_ID=your-client-id
CATALOG_OAUTH_CLIENT_SECRET=your-client-secret
```

### Multiple Systems Configuration

You can configure multiple systems using numbered prefixes:

```env
# System 1 - Northwind OData Service
SYSTEM1_NAME=Northwind Demo
SYSTEM1_DESCRIPTION=Public Northwind OData demonstration service
SYSTEM1_TYPE=generic_odata
SYSTEM1_BASE_URL=https://services.odata.org/V4/Northwind/Northwind.svc
SYSTEM1_AUTH_TYPE=none

# System 2 - SAP Business Partner API
SYSTEM2_NAME=Business Partner API
SYSTEM2_TYPE=sap_onpremise
SYSTEM2_BASE_URL=https://my-sap-system.com/sap/opu/odata/sap/API_BUSINESS_PARTNER
SYSTEM2_AUTH_TYPE=basic
SYSTEM2_USERNAME=developer
SYSTEM2_PASSWORD=your-password
SYSTEM2_CLIENT=100
SYSTEM2_ENABLE_CSRF=true

# System 3 - Custom OAuth Service
SYSTEM3_NAME=Custom API
SYSTEM3_TYPE=generic_odata
SYSTEM3_BASE_URL=https://api.example.com/odata
SYSTEM3_AUTH_TYPE=oauth2
SYSTEM3_OAUTH_TOKEN_URL=https://auth.example.com/oauth/token
SYSTEM3_OAUTH_CLIENT_ID=client-id
SYSTEM3_OAUTH_CLIENT_SECRET=client-secret
SYSTEM3_OAUTH_SCOPE=api.read
```

### Named System Prefixes

You can also use descriptive prefixes:

```env
# Northwind Demo Service
NORTHWIND_NAME=Northwind Demo
NORTHWIND_BASE_URL=https://services.odata.org/V4/Northwind/Northwind.svc
NORTHWIND_TYPE=generic_odata
NORTHWIND_AUTH_TYPE=none

# Demo Service
DEMO_NAME=Demo Service
DEMO_BASE_URL=https://demo.example.com/odata
DEMO_AUTH_TYPE=basic
DEMO_USERNAME=demo
DEMO_PASSWORD=demo123
```

## Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Build the application
npm run build
```

The MCP server will start and automatically:
1. Load all configured systems from environment variables
2. Attempt to connect to available systems
3. Register MCP tools for system management

## Available MCP Tools

### System Management Tools

#### `system_connect`
Connect to a configured system and test connectivity.

```json
{
  "systemId": "northwind"
}
```

#### `system_get_services` 
Discover available OData services in a connected system.

```json
{
  "systemId": "btp-catalog"
}
```

#### `odata_service_info`
Get detailed information about a specific OData service, including metadata, entities, and available operations.

```json
{
  "systemId": "northwind", 
  "serviceId": "https://services.odata.org/V4/Northwind/Northwind.svc",
  "includeMetadata": true
}
```

### Dynamic Entity Tools

Once you retrieve service information, the server automatically generates entity-specific tools:

#### Filter/List Entities
```json
// Tool: filter_Products_for_NW
{
  "$filter": "UnitPrice gt 20",
  "$select": ["ProductName", "UnitPrice", "CategoryID"],
  "$orderby": "ProductName asc",
  "$top": 10
}
```

#### Get Single Entity  
```json
// Tool: get_Product_for_NW
{
  "ProductID": 1,
  "$select": ["ProductName", "UnitPrice"],
  "$expand": ["Category"]
}
```

#### Count Entities
```json  
// Tool: count_Products_for_NW
{
  "$filter": "Discontinued eq false"
}
```

#### Search Entities
```json
// Tool: search_Products_for_NW  
{
  "search": "dairy",
  "$top": 5
}
```

#### Create Entity
```json
// Tool: create_Product_for_NW
{
  "ProductName": "New Product",
  "UnitPrice": 25.99,
  "CategoryID": 1,
  "Discontinued": false
}
```

#### Update Entity
```json
// Tool: update_Product_for_NW  
{
  "ProductID": 1,
  "UnitPrice": 29.99,
  "Discontinued": false
}
```

#### Delete Entity
```json
// Tool: delete_Product_for_NW
{
  "ProductID": 1
}
```

## System Types and Authentication

### Generic OData (`generic_odata`)
For any standard OData service. Supports anonymous access and basic authentication.

### SAP On-Premise (`sap_onpremise`)  
Optimized for SAP Gateway services with:
- SAP client number support
- CSRF token handling
- Service catalog discovery via `/sap/bc/rest/backends/catalog/services`

### SAP BTP (`btp`)
For SAP Business Technology Platform services with:
- OAuth 2.0 client credentials flow
- Automatic token refresh
- BTP-specific service discovery patterns

## Authentication Methods

### None (`auth_type: none`)
For public APIs or services behind a gateway:
```env
SYSTEM1_AUTH_TYPE=none
```

### Basic Authentication (`auth_type: basic`)
Username and password authentication:
```env  
SYSTEM1_AUTH_TYPE=basic
SYSTEM1_USERNAME=your-username
SYSTEM1_PASSWORD=your-password
SYSTEM1_CLIENT=100  # Optional SAP client
```

### OAuth 2.0 (`auth_type: oauth2`)
Client credentials flow with automatic token management:
```env
SYSTEM1_AUTH_TYPE=oauth2
SYSTEM1_OAUTH_TOKEN_URL=https://auth.example.com/oauth/token
SYSTEM1_OAUTH_CLIENT_ID=your-client-id  
SYSTEM1_OAUTH_CLIENT_SECRET=your-client-secret
SYSTEM1_OAUTH_SCOPE=optional-scope
```

## Advanced Configuration

### Custom Headers
Add custom HTTP headers to requests:
```env
SYSTEM1_CUSTOM_HEADERS={"X-API-Key": "your-key", "Custom-Header": "value"}
# Or simple format:  
SYSTEM1_CUSTOM_HEADERS=X-API-Key=your-key,Custom-Header=value
```

### SSL Configuration
```env
SYSTEM1_VALIDATE_SSL=false  # Disable SSL certificate validation
```

### Timeouts
```env
SYSTEM1_TIMEOUT=60000  # Request timeout in milliseconds
```

### Service Discovery
```env
SYSTEM1_DISCOVERY_URL=/custom/catalog/endpoint  # Custom discovery endpoint
```

## Tool Naming Configuration

The server generates tool names using configurable patterns:

- **Default**: `operation_EntitySet_for_ServiceId` (e.g., `filter_Products_for_NW`)
- **Shortened**: Uses abbreviated operation names (`upd` vs `update`, `del` vs `delete`)
- **Service ID**: Automatically extracted from service URLs for concise naming

## Error Handling

The server provides comprehensive error handling:

- **Connection Failures**: Clear error messages for connectivity issues
- **Authentication Errors**: Specific guidance for auth problems  
- **CSRF Errors**: Automatic token refresh and retry
- **Metadata Errors**: Detailed parsing error information
- **Query Errors**: OData-specific error translation

## Development

### Project Structure
```
src/
├── app.module.ts              # Main application module
├── system/                    # System management module  
│   ├── services/
│   │   ├── system-config.service.ts      # Environment configuration
│   │   ├── universal-system-client.service.ts  # Universal OData client
│   │   ├── metadata-parser.service.ts     # OData metadata parser
│   │   └── tool-generator.service.ts      # Dynamic tool generation
│   ├── resolvers/
│   │   └── system.resolver.ts             # MCP tools implementation
│   └── types/
│       └── system.types.ts                # Type definitions
├── mcp/                       # MCP server module
│   └── services/
│       └── oauth.service.ts               # OAuth 2.0 service
└── test-tools.controller.ts   # HTTP test endpoints
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests  
npm run test:e2e

# Test coverage
npm run test:cov
```

### HTTP Test Endpoints

For debugging, the server provides HTTP endpoints that mirror the MCP tools:

- `POST /test-tools/system-connect` - Test system connections
- `POST /test-tools/system-get-services` - Test service discovery  
- `POST /test-tools/odata-service-info` - Test metadata parsing

## Troubleshooting

### Common Issues

**Systems not loading:**
- Check environment variable names and formats
- Ensure required variables are set (BASE_URL, credentials)
- Check application logs for configuration errors

**Connection failures:**
- Verify URLs and network connectivity
- Check SSL settings (`VALIDATE_SSL=false` for self-signed certificates)
- Verify authentication credentials

**OAuth errors:**  
- Confirm client ID and secret are correct
- Check token URL is accessible
- Verify required scopes are granted

**CSRF token failures:**
- Enable CSRF for SAP systems (`ENABLE_CSRF=true`)
- Check system supports CSRF token endpoint
- Verify proper authentication before CSRF token fetch

### Debug Logging

Set environment variable for detailed logging:
```env
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality  
5. Run the test suite
6. Submit a pull request

## License

This project is MIT licensed.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review application logs for detailed error messages
- Create an issue in the repository with:
  - System configuration (without credentials)
  - Error messages and logs
  - Steps to reproduce

---

🚀 **Ready to connect to any OData service with dynamic tool generation!**