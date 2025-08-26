import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { McpModule as NestMcpModule } from "@nestjs-mcp/server";
import { McpResolver } from "./mcp.resolver";
import { ODataResolver } from "./resolvers/odata.resolver";
import { ODataClientService } from "./services/odata-client.service";

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
  providers: [McpResolver, ODataResolver, ODataClientService],
  exports: [NestMcpModule, ODataClientService],
})
export class McpServerModule {}