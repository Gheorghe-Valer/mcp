import { Controller, Post, Body, Get } from '@nestjs/common';
import { MultiODataClientService } from './mcp/services/multi-odata-client.service';
import { MetadataDiscoveryService } from './mcp/services/metadata-discovery.service';

@Controller('test-tools')
export class TestToolsController {
  constructor(
    private multiODataClient: MultiODataClientService,
    private metadataDiscovery: MetadataDiscoveryService,
  ) {}

  @Get('list-systems')
  async listSystems() {
    try {
      const systems = this.multiODataClient.getAllSystems();
      
      return {
        success: true,
        systems: systems.map(system => ({
          id: system.id,
          name: system.name,
          description: system.description,
          baseUrl: system.baseUrl,
          authType: system.authType,
          connected: this.multiODataClient.getConnectionInfo(system.id)?.connected || false,
        })),
        total: systems.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        systems: [],
        total: 0,
      };
    }
  }

  @Post('connect-system')
  async connectSystem(@Body() body: { systemId: string }) {
    try {
      const connected = await this.multiODataClient.connect(body.systemId);
      const connectionInfo = this.multiODataClient.getConnectionInfo(body.systemId);
      
      return {
        success: connected,
        connectionInfo,
        message: connected 
          ? `Successfully connected to OData system: ${body.systemId}`
          : `Failed to connect to OData system: ${body.systemId}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  @Post('get-metadata')
  async getMetadata(@Body() body: { systemId: string; includeRaw?: boolean }) {
    try {
      const metadata = await this.metadataDiscovery.discoverSystemMetadata(body.systemId);
      
      const result = body.includeRaw 
        ? metadata 
        : this.metadataDiscovery.formatMetadataForMcp(metadata);

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Failed to retrieve metadata for system: ${body.systemId}`,
      };
    }
  }

  @Post('query-entity')
  async queryEntity(@Body() body: {
    systemId: string;
    entitySetName: string;
    select?: string[];
    filter?: string;
    orderby?: string;
    top?: number;
    skip?: number;
    expand?: string[];
  }) {
    try {
      const result = await this.multiODataClient.queryEntitySet(body.systemId, body.entitySetName, {
        select: body.select,
        filter: body.filter,
        orderby: body.orderby,
        top: body.top,
        skip: body.skip,
        expand: body.expand,
      });

      const responseData = result.d?.results || result.d || result;
      const count = Array.isArray(responseData) ? responseData.length : 1;

      return {
        success: true,
        data: responseData,
        recordsReturned: count,
        metadata: {
          systemId: body.systemId,
          entitySetName: body.entitySetName,
          queryOptions: {
            select: body.select,
            filter: body.filter,
            orderby: body.orderby,
            top: body.top,
            skip: body.skip,
            expand: body.expand,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Failed to query ${body.entitySetName} from system ${body.systemId}: ${error.message}`,
      };
    }
  }
}