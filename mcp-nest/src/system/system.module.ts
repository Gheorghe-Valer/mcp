import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpModule as NestMcpModule } from "@nestjs-mcp/server";
import { SystemConfigService } from './services/system-config.service';
import { UniversalSystemClientService } from './services/universal-system-client.service';
import { MetadataParserService } from './services/metadata-parser.service';
import { ToolGeneratorService } from './services/tool-generator.service';
import { SystemResolver } from './resolvers/system.resolver';
import { OAuth2Service } from '../mcp/services/oauth.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NestMcpModule.forRoot({
      name: "Universal OData MCP Server",
      version: "1.0.0",
      instructions: "This server provides universal access to OData services through MCP tools. Use system_connect to establish connections, system_get_services to discover services, and odata_service_info to get metadata and available operations.",
      transports: {
        streamable: { enabled: true },
        sse: { enabled: true },
      },
    }),
  ],
  providers: [
    SystemConfigService,
    UniversalSystemClientService,
    MetadataParserService,
    ToolGeneratorService,
    SystemResolver,
    OAuth2Service,
  ],
  exports: [
    NestMcpModule,
    SystemConfigService,
    UniversalSystemClientService,
    MetadataParserService,
    ToolGeneratorService,
  ],
})
export class SystemModule {}