import { Injectable } from '@nestjs/common';
import { Resolver, Tool } from '@nestjs-mcp/server';
import { MultiODataClientService } from '../services/multi-odata-client.service';
import { MetadataDiscoveryService } from '../services/metadata-discovery.service';
import { ODataJsonRpcBridgeService } from '../services/odata-jsonrpc-bridge.service';
import { z } from 'zod';

@Injectable()
@Resolver()
export class MultiODataResolver {
  constructor(
    private multiODataClient: MultiODataClientService,
    private metadataDiscovery: MetadataDiscoveryService,
    private jsonRpcBridge: ODataJsonRpcBridgeService,
  ) {}

  @Tool({
    name: 'connect_odata_system',
    description: 'Connect to an OData system and test the connection',
    paramsSchema: {
      systemId: z.string().describe('The ID of the OData system to connect to'),
    },
  })
  async connectODataSystem(params: { systemId: string }) {
    try {
      const connected = await this.multiODataClient.connect(params.systemId);
      const connectionInfo = this.multiODataClient.getConnectionInfo(params.systemId);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: connected,
              connectionInfo,
              message: connected 
                ? `Successfully connected to OData system: ${params.systemId}`
                : `Failed to connect to OData system: ${params.systemId}`,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              message: `Connection failed: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'list_odata_systems',
    description: 'List all available OData systems configured in the server',
  })
  async listODataSystems() {
    try {
      const systems = this.multiODataClient.getAllSystems();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              systems: systems.map(system => ({
                id: system.id,
                name: system.name,
                description: system.description,
                baseUrl: system.baseUrl,
                authType: system.authType,
                connected: this.multiODataClient.getConnectionInfo(system.id)?.connected || false,
              })),
              total: systems.length,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
              systems: [],
              total: 0,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'get_system_metadata',
    description: 'Get metadata for a specific OData system including entities, entity sets, and functions',
    paramsSchema: {
      systemId: z.string().describe('The ID of the OData system'),
      includeRaw: z.boolean().optional().describe('Include raw metadata XML in response'),
    },
  })
  async getSystemMetadata(params: { systemId: string; includeRaw?: boolean }) {
    try {
      const metadata = await this.metadataDiscovery.discoverSystemMetadata(params.systemId);
      
      const result = params.includeRaw 
        ? metadata 
        : this.metadataDiscovery.formatMetadataForMcp(metadata);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
              message: `Failed to retrieve metadata for system: ${params.systemId}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'query_odata_entity',
    description: 'Query an entity set from a specific OData system with optional filtering, selection, and pagination',
    paramsSchema: {
      systemId: z.string().describe('The ID of the OData system'),
      entitySetName: z.string().describe('The name of the entity set to query'),
      select: z.array(z.string()).optional().describe('Fields to select (OData $select)'),
      filter: z.string().optional().describe('Filter expression (OData $filter)'),
      orderby: z.string().optional().describe('Order by expression (OData $orderby)'),
      top: z.number().min(1).optional().describe('Maximum number of records to return (OData $top)'),
      skip: z.number().min(0).optional().describe('Number of records to skip (OData $skip)'),
      expand: z.array(z.string()).optional().describe('Navigation properties to expand (OData $expand)'),
    },
  })
  async queryODataEntity(params: {
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
      const result = await this.multiODataClient.queryEntitySet(params.systemId, params.entitySetName, {
        select: params.select,
        filter: params.filter,
        orderby: params.orderby,
        top: params.top,
        skip: params.skip,
        expand: params.expand,
      });

      const responseData = result.d?.results || result.d || result;
      const count = Array.isArray(responseData) ? responseData.length : 1;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              data: responseData,
              recordsReturned: count,
              metadata: {
                systemId: params.systemId,
                entitySetName: params.entitySetName,
                queryOptions: {
                  select: params.select,
                  filter: params.filter,
                  orderby: params.orderby,
                  top: params.top,
                  skip: params.skip,
                  expand: params.expand,
                },
                timestamp: new Date().toISOString(),
              },
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              message: `Failed to query ${params.entitySetName} from system ${params.systemId}: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'get_entity_schema',
    description: 'Get the schema definition for a specific entity set',
    paramsSchema: {
      systemId: z.string().describe('The ID of the OData system'),
      entitySetName: z.string().describe('The name of the entity set'),
    },
  })
  async getEntitySchema(params: { systemId: string; entitySetName: string }) {
    try {
      const entity = await this.metadataDiscovery.getEntitySchema(params.systemId, params.entitySetName);
      
      if (!entity) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Entity set ${params.entitySetName} not found in system ${params.systemId}`,
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: entity.name,
              properties: entity.properties.map(prop => ({
                name: prop.name,
                type: prop.type,
                nullable: prop.nullable,
              })),
              propertiesCount: entity.properties.length,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
              message: `Failed to get schema for ${params.entitySetName} in system ${params.systemId}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'get_system_connection_info',
    description: 'Get detailed connection information for a specific OData system',
    paramsSchema: {
      systemId: z.string().describe('The ID of the OData system'),
    },
  })
  async getSystemConnectionInfo(params: { systemId: string }) {
    try {
      const connectionInfo = this.multiODataClient.getConnectionInfo(params.systemId);
      
      if (!connectionInfo) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `System ${params.systemId} not found`,
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(connectionInfo, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
              message: `Failed to get connection info for system: ${params.systemId}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'disconnect_odata_system',
    description: 'Disconnect from a specific OData system',
    paramsSchema: {
      systemId: z.string().describe('The ID of the OData system to disconnect from'),
    },
  })
  async disconnectODataSystem(params: { systemId: string }) {
    try {
      this.multiODataClient.disconnect(params.systemId);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Disconnected from OData system: ${params.systemId}`,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              message: `Failed to disconnect from system: ${params.systemId}`,
            }, null, 2),
          },
        ],
      };
    }
  }
}