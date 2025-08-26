import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { McpModule as NestMcpModule } from "@nestjs-mcp/server";
import { McpResolver } from "./mcp.resolver";
import { ODataResolver } from "./resolvers/odata.resolver";
import { MultiODataResolver } from "./resolvers/multi-odata.resolver";
import { ODataClientService } from "./services/odata-client.service";
import { OAuth2Service } from "./services/oauth.service";
import { MultiODataClientService } from "./services/multi-odata-client.service";
import { MetadataDiscoveryService } from "./services/metadata-discovery.service";
import { ODataJsonRpcBridgeService } from "./services/odata-jsonrpc-bridge.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NestMcpModule.forRoot({
      name: "SAP OData MCP Server",
      version: "1.0.0",
      instructions: "This server provides access to SAP OData services through MCP tools. Use sap_connect first to establish connection, then explore services with sap_get_services and retrieve metadata with sap_get_service_metadata.",
      transports: {
        streamable: { enabled: true },
        sse: { enabled: true },
      },
    }),
  ],
  providers: [
    McpResolver, 
    ODataResolver,
    MultiODataResolver,
    ODataClientService,
    OAuth2Service,
    MultiODataClientService,
    MetadataDiscoveryService,
    ODataJsonRpcBridgeService,
  ],
  exports: [
    NestMcpModule, 
    ODataClientService,
    OAuth2Service,
    MultiODataClientService,
    MetadataDiscoveryService,
    ODataJsonRpcBridgeService,
  ],
})
export class McpServerModule {}