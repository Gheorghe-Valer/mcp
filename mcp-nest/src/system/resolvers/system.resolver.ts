import { Injectable } from '@nestjs/common';
import { Resolver, Tool } from '@nestjs-mcp/server';
import { SystemConfigService } from '../services/system-config.service';
import { UniversalSystemClientService } from '../services/universal-system-client.service';
import { ODataQueryOptionsSchema } from '../types/system.types';
import { z } from 'zod';

@Injectable()
@Resolver()
export class SystemResolver {
  constructor(
    private systemConfigService: SystemConfigService,
    private systemClient: UniversalSystemClientService,
  ) {}

  @Tool({
    name: 'system_connect',
    description: 'Connect to a system and test the connection availability',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system to connect to'),
    },
  })
  async systemConnect(params: { systemId: string }) {
    try {
      const systemConfig = this.systemConfigService.getSystem(params.systemId);
      if (!systemConfig) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `System ${params.systemId} not found`,
                availableSystems: this.systemConfigService.getAllSystems().map(s => s.id),
              }, null, 2),
            },
          ],
        };
      }

      const connected = await this.systemClient.connect(systemConfig);
      const connectionInfo = this.systemClient.getConnectionInfo(params.systemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: connected,
              systemId: params.systemId,
              systemName: systemConfig.name,
              systemType: systemConfig.type,
              authType: systemConfig.authType,
              connectionInfo,
              message: connected 
                ? `Successfully connected to ${systemConfig.name}`
                : `Failed to connect to ${systemConfig.name}`,
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
              systemId: params.systemId,
              message: `Connection failed: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'system_get_services',
    description: 'Discover all available OData services on a system (SAP catalog discovery for SAP systems, direct service for BTP)',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system to discover services from'),
    },
  })
  async systemGetServices(params: { systemId: string }) {
    try {
      const systemConfig = this.systemConfigService.getSystem(params.systemId);
      if (!systemConfig) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `System ${params.systemId} not found`,
              }, null, 2),
            },
          ],
        };
      }

      // Ensure system is connected
      const connectionInfo = this.systemClient.getConnectionInfo(params.systemId);
      if (!connectionInfo?.connected) {
        const connected = await this.systemClient.connect(systemConfig);
        if (!connected) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `Cannot connect to system ${params.systemId}`,
                  message: 'Use system_connect first to establish connection',
                }, null, 2),
              },
            ],
          };
        }
      }

      const services = await this.systemClient.discoverServices(systemConfig);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              systemId: params.systemId,
              systemName: systemConfig.name,
              systemType: systemConfig.type,
              discoveryMethod: this.getDiscoveryMethod(systemConfig.type),
              services,
              totalServices: services.length,
              message: `Discovered ${services.length} services from ${systemConfig.name}`,
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
              systemId: params.systemId,
              message: `Service discovery failed: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'odata_service_info',
    description: 'Get detailed information about an OData service including metadata, entities, and available operations converted to JSON-RPC format',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system'),
      serviceId: z.string().optional().describe('The ID of the specific service (optional for single-service systems)'),
      includeMetadata: z.boolean().optional().describe('Include detailed metadata information'),
    },
  })
  async odataServiceInfo(params: { systemId: string; serviceId?: string; includeMetadata?: boolean }) {
    try {
      const systemConfig = this.systemConfigService.getSystem(params.systemId);
      if (!systemConfig) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `System ${params.systemId} not found`,
              }, null, 2),
            },
          ],
        };
      }

      // Get service metadata
      const serviceUrl = params.serviceId || systemConfig.baseUrl;
      const service = await this.systemClient.getServiceMetadata(systemConfig, serviceUrl);
      const metadata = service.metadata;

      // Generate available operations and tools
      const availableOperations = this.generateAvailableOperations(metadata, params.systemId, params.serviceId);

      const result = {
        success: true,
        systemId: params.systemId,
        systemName: systemConfig.name,
        serviceId: params.serviceId || 'default',
        metadata: {
          entitiesCount: metadata?.entities?.length || 0,
          entitySetsCount: metadata?.entitySets?.length || 0,
          functionsCount: metadata?.functions?.length || 0,
          actionsCount: metadata?.actions?.length || 0,
        },
        entities: metadata?.entities?.map((entity: any) => ({
          name: entity.name,
          keyProperties: entity.keyProperties || [],
          propertiesCount: entity.properties?.length || 0,
          properties: entity.properties || [],
        })) || [],
        entitySets: metadata?.entitySets?.map((entitySet: any) => ({
          name: entitySet.name,
          entityType: entitySet.entityType,
          capabilities: {
            creatable: entitySet.creatable !== false,
            updatable: entitySet.updatable !== false,
            deletable: entitySet.deletable !== false,
            searchable: entitySet.searchable === true,
            countable: entitySet.countable !== false,
          },
        })) || [],
        availableOperations,
        jsonRpcTools: this.generateToolDescriptions(metadata, params.systemId, params.serviceId),
      };

      if (params.includeMetadata) {
        (result as any).rawMetadata = metadata?.raw;
      }

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
              success: false,
              error: error.message,
              systemId: params.systemId,
              serviceId: params.serviceId,
              message: `Failed to get service info: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'list_systems',
    description: 'List all configured systems with their basic information',
  })
  async listSystems() {
    try {
      const systems = this.systemConfigService.getAllSystems();
      
      const systemsInfo = systems.map(system => {
        const connectionInfo = this.systemClient.getConnectionInfo(system.id);
        
        return {
          id: system.id,
          name: system.name,
          description: system.description,
          type: system.type,
          authType: system.authType,
          baseUrl: system.baseUrl,
          connected: connectionInfo?.connected || false,
          lastConnected: connectionInfo?.lastConnected,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              systems: systemsInfo,
              totalSystems: systems.length,
              connectedSystems: systemsInfo.filter(s => s.connected).length,
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
              message: `Failed to list systems: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'filter_entity',
    description: 'List/filter entities from an OData service with query options (equivalent to OData $filter operation)',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system'),
      entitySet: z.string().describe('The name of the entity set to query'),
      serviceId: z.string().optional().describe('The ID of the service (optional for single-service systems)'),
      ...ODataQueryOptionsSchema.shape,
    },
  })
  async filterEntity(params: {
    systemId: string;
    entitySet: string;
    serviceId?: string;
    select?: string[];
    filter?: string;
    orderby?: string;
    top?: number;
    skip?: number;
    expand?: string[];
    count?: boolean;
    search?: string;
  }) {
    try {
      const systemConfig = this.systemConfigService.getSystem(params.systemId);
      if (!systemConfig) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `System ${params.systemId} not found`,
              }, null, 2),
            },
          ],
        };
      }

      const queryOptions = {
        select: params.select,
        filter: params.filter,
        orderby: params.orderby,
        top: params.top,
        skip: params.skip,
        expand: params.expand,
        count: params.count,
        search: params.search,
      };

      const result = await this.systemClient.executeQuery(
        systemConfig,
        params.entitySet,
        queryOptions,
        params.serviceId
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              ...result,
              recordsReturned: Array.isArray(result.data) ? result.data.length : 1,
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
              systemId: params.systemId,
              entitySet: params.entitySet,
              message: `Filter operation failed: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'count_entity',
    description: 'Get the count of entities in an entity set with optional filter',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system'),
      entitySet: z.string().describe('The name of the entity set to count'),
      serviceId: z.string().optional().describe('The ID of the service (optional)'),
      filter: z.string().optional().describe('Optional filter expression to count only matching entities'),
    },
  })
  async countEntity(params: {
    systemId: string;
    entitySet: string;
    serviceId?: string;
    filter?: string;
  }) {
    try {
      const systemConfig = this.systemConfigService.getSystem(params.systemId);
      if (!systemConfig) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `System ${params.systemId} not found`,
              }, null, 2),
            },
          ],
        };
      }

      const result = await this.systemClient.executeQuery(
        systemConfig,
        params.entitySet,
        { filter: params.filter, count: true, top: 0 }, // Just get count, no data
        params.serviceId
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              systemId: params.systemId,
              entitySet: params.entitySet,
              filter: params.filter,
              count: result.count || 0,
              timestamp: result.metadata.timestamp,
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
              systemId: params.systemId,
              entitySet: params.entitySet,
              message: `Count operation failed: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'get_system_connection_info',
    description: 'Get detailed connection information for a system',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system'),
    },
  })
  async getSystemConnectionInfo(params: { systemId: string }) {
    try {
      const systemConfig = this.systemConfigService.getSystem(params.systemId);
      if (!systemConfig) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `System ${params.systemId} not found`,
              }, null, 2),
            },
          ],
        };
      }

      const connectionInfo = this.systemClient.getConnectionInfo(params.systemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              systemId: params.systemId,
              systemName: systemConfig.name,
              systemType: systemConfig.type,
              connectionInfo: connectionInfo || {
                systemId: params.systemId,
                connected: false,
                connectionDetails: {
                  baseUrl: systemConfig.baseUrl,
                  authType: systemConfig.authType,
                  timeout: systemConfig.timeout || 30000,
                  validateSSL: systemConfig.validateSSL !== false,
                  enableCSRF: systemConfig.enableCSRF || false,
                },
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
              message: `Failed to get connection info: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'disconnect_system',
    description: 'Disconnect from a system and clear its connection state',
    paramsSchema: {
      systemId: z.string().describe('The ID of the system to disconnect from'),
    },
  })
  async disconnectSystem(params: { systemId: string }) {
    try {
      this.systemClient.disconnect(params.systemId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              systemId: params.systemId,
              message: `Disconnected from system ${params.systemId}`,
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
              systemId: params.systemId,
              message: `Disconnect failed: ${error.message}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private getDiscoveryMethod(systemType: string): string {
    switch (systemType) {
      case 'sap_onpremise':
        return 'SAP Gateway Catalog';
      case 'sap_btp':
        return 'Direct BTP Service';
      default:
        return 'Generic OData Discovery';
    }
  }

  private generateAvailableOperations(metadata: any, systemId: string, serviceId?: string): string[] {
    const operations = ['service_info', 'filter', 'count'];
    
    if (metadata.entitySets?.some((es: any) => es.searchable)) {
      operations.push('search');
    }
    
    operations.push('get');
    
    if (metadata.entitySets?.some((es: any) => es.creatable !== false)) {
      operations.push('create');
    }
    
    if (metadata.entitySets?.some((es: any) => es.updatable !== false)) {
      operations.push('update');
    }
    
    if (metadata.entitySets?.some((es: any) => es.deletable !== false)) {
      operations.push('delete');
    }

    return operations;
  }

  private generateToolDescriptions(metadata: any, systemId: string, serviceId?: string): any[] {
    const tools: any[] = [];

    // Add basic tools
    tools.push({
      name: 'filter_entity',
      description: 'List/filter entities with OData query options',
      operation: 'filter',
    });

    tools.push({
      name: 'count_entity',
      description: 'Get count of entities with optional filter',
      operation: 'count',
    });

    // Add entity-specific tools if we have entity sets
    if (metadata.entitySets) {
      metadata.entitySets.forEach((entitySet: any) => {
        tools.push({
          name: `get_${entitySet.name.toLowerCase()}`,
          description: `Get a specific ${entitySet.name} entity by key`,
          operation: 'get',
          entitySet: entitySet.name,
        });

        if (entitySet.creatable !== false) {
          tools.push({
            name: `create_${entitySet.name.toLowerCase()}`,
            description: `Create a new ${entitySet.name} entity`,
            operation: 'create',
            entitySet: entitySet.name,
          });
        }

        if (entitySet.updatable !== false) {
          tools.push({
            name: `update_${entitySet.name.toLowerCase()}`,
            description: `Update an existing ${entitySet.name} entity`,
            operation: 'update',
            entitySet: entitySet.name,
          });
        }

        if (entitySet.deletable !== false) {
          tools.push({
            name: `delete_${entitySet.name.toLowerCase()}`,
            description: `Delete a ${entitySet.name} entity`,
            operation: 'delete',
            entitySet: entitySet.name,
          });
        }
      });
    }

    return tools;
  }
}