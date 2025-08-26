import { Injectable, Logger } from '@nestjs/common';
import { MultiODataClientService } from './multi-odata-client.service';
import { MetadataDiscoveryService } from './metadata-discovery.service';
import {
  ODataQueryOptions,
  ODataToJsonRpcMapping,
  JsonRpcTool,
} from '../types/odata.types';

export interface JsonRpcRequest {
  method: string;
  params?: any;
  id?: string | number;
}

export interface JsonRpcResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string | number;
}

@Injectable()
export class ODataJsonRpcBridgeService {
  private readonly logger = new Logger(ODataJsonRpcBridgeService.name);
  private toolMappings = new Map<string, ODataToJsonRpcMapping>();

  constructor(
    private multiODataClient: MultiODataClientService,
    private metadataDiscovery: MetadataDiscoveryService,
  ) {}

  async initializeTools(): Promise<void> {
    this.logger.log('Initializing OData to JSON-RPC tool mappings...');
    
    try {
      const mappings = await this.metadataDiscovery.discoverAllSystemsMetadata();
      mappings.forEach((mapping, systemId) => {
        this.toolMappings.set(systemId, mapping);
      });
      
      const totalTools = Array.from(mappings.values())
        .reduce((total, mapping) => total + mapping.tools.length, 0);
      
      this.logger.log(`Initialized ${totalTools} JSON-RPC tools across ${mappings.size} systems`);
    } catch (error: any) {
      this.logger.error('Failed to initialize tool mappings', error.message);
      throw error;
    }
  }

  getAllTools(): JsonRpcTool[] {
    const allTools: JsonRpcTool[] = [];
    
    this.toolMappings.forEach(mapping => {
      allTools.push(...mapping.tools);
    });

    allTools.push({
      name: 'list_odata_systems',
      description: 'List all available OData systems',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    });

    allTools.push({
      name: 'get_system_connection_info',
      description: 'Get connection information for a specific OData system',
      inputSchema: {
        type: 'object',
        properties: {
          systemId: {
            type: 'string',
            description: 'The ID of the OData system',
          },
        },
        required: ['systemId'],
      },
    });

    return allTools;
  }

  async handleJsonRpcCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logger.debug(`Handling JSON-RPC call: ${request.method}`);
    
    try {
      const result = await this.executeMethod(request.method, request.params || {});
      
      return {
        result,
        id: request.id,
      };
    } catch (error: any) {
      this.logger.error(`JSON-RPC call failed: ${request.method}`, error.message);
      
      return {
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
        id: request.id,
      };
    }
  }

  private async executeMethod(method: string, params: any): Promise<any> {
    if (method === 'list_odata_systems') {
      return this.listODataSystems();
    }

    if (method === 'get_system_connection_info') {
      return this.getSystemConnectionInfo(params.systemId);
    }

    const [systemId, action, ...parts] = method.split('_');
    
    if (!systemId) {
      throw new Error('Invalid method name format');
    }

    switch (action) {
      case 'get':
        if (parts[0] === 'metadata') {
          return this.getMetadata(systemId, params);
        } else if (parts.length >= 2 && parts[parts.length - 1] === 'schema') {
          const entitySetName = parts.slice(0, -1).join('_');
          return this.getEntitySchema(systemId, entitySetName);
        }
        break;

      case 'list':
        if (parts[0] === 'entities') {
          return this.listEntities(systemId);
        } else if (parts[0] === 'entity' && parts[1] === 'sets') {
          return this.listEntitySets(systemId);
        } else if (parts[0] === 'functions') {
          return this.listFunctions(systemId);
        }
        break;

      case 'query':
        const entitySetName = parts.join('_');
        return this.queryEntitySet(systemId, entitySetName, params);
    }

    throw new Error(`Unknown method: ${method}`);
  }

  private listODataSystems(): any {
    const systems = this.multiODataClient.getAllSystems();
    
    return {
      systems: systems.map(system => ({
        id: system.id,
        name: system.name,
        description: system.description,
        authType: system.authType,
        connected: this.multiODataClient.getConnectionInfo(system.id)?.connected || false,
      })),
      total: systems.length,
    };
  }

  private getSystemConnectionInfo(systemId: string): any {
    const connectionInfo = this.multiODataClient.getConnectionInfo(systemId);
    
    if (!connectionInfo) {
      throw new Error(`System ${systemId} not found`);
    }

    return connectionInfo;
  }

  private async getMetadata(systemId: string, params: any): Promise<any> {
    const metadata = await this.metadataDiscovery.discoverSystemMetadata(systemId);
    
    if (params.includeRaw) {
      return metadata;
    }

    return this.metadataDiscovery.formatMetadataForMcp(metadata);
  }

  private async listEntities(systemId: string): Promise<any> {
    const metadata = await this.metadataDiscovery.discoverSystemMetadata(systemId);
    
    return {
      entities: metadata.entities.map(entity => ({
        name: entity.name,
        propertiesCount: entity.properties.length,
        properties: entity.properties.map(prop => ({
          name: prop.name,
          type: prop.type,
          nullable: prop.nullable,
        })),
      })),
      total: metadata.entities.length,
    };
  }

  private async listEntitySets(systemId: string): Promise<any> {
    const metadata = await this.metadataDiscovery.discoverSystemMetadata(systemId);
    
    return {
      entitySets: metadata.entitySets.map(entitySet => ({
        name: entitySet.name,
        entityType: entitySet.entityType,
      })),
      total: metadata.entitySets.length,
    };
  }

  private async listFunctions(systemId: string): Promise<any> {
    const metadata = await this.metadataDiscovery.discoverSystemMetadata(systemId);
    
    return {
      functions: metadata.functions.map(func => ({
        name: func.name,
        returnType: func.returnType,
      })),
      total: metadata.functions.length,
    };
  }

  private async getEntitySchema(systemId: string, entitySetName: string): Promise<any> {
    const entity = await this.metadataDiscovery.getEntitySchema(systemId, entitySetName);
    
    if (!entity) {
      throw new Error(`Entity set ${entitySetName} not found in system ${systemId}`);
    }

    return {
      name: entity.name,
      properties: entity.properties.map(prop => ({
        name: prop.name,
        type: prop.type,
        nullable: prop.nullable,
      })),
      propertiesCount: entity.properties.length,
    };
  }

  private async queryEntitySet(systemId: string, entitySetName: string, params: any): Promise<any> {
    const options: ODataQueryOptions = {};

    if (params.select) {
      options.select = Array.isArray(params.select) ? params.select : [params.select];
    }
    if (params.filter) {
      options.filter = params.filter;
    }
    if (params.orderby) {
      options.orderby = params.orderby;
    }
    if (params.top) {
      options.top = parseInt(params.top);
    }
    if (params.skip) {
      options.skip = parseInt(params.skip);
    }
    if (params.expand) {
      options.expand = Array.isArray(params.expand) ? params.expand : [params.expand];
    }

    if (params.key) {
      const entity = await this.metadataDiscovery.getEntitySchema(systemId, entitySetName);
      if (entity) {
        const keyField = entity.properties.find(p => 
          p.name.toLowerCase().includes('id') || p.name.toLowerCase().includes('key')
        );
        if (keyField) {
          options.filter = `${keyField.name} eq '${params.key}'`;
        }
      }
    }

    this.logger.debug(`Querying ${entitySetName} on ${systemId} with options:`, options);

    const result = await this.multiODataClient.queryEntitySet(systemId, entitySetName, options);

    return {
      data: result,
      metadata: {
        systemId,
        entitySetName,
        queryOptions: options,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async refreshSystemTools(systemId: string): Promise<void> {
    this.logger.log(`Refreshing tools for system: ${systemId}`);
    
    try {
      const mapping = await this.metadataDiscovery.generateJsonRpcTools(systemId);
      this.toolMappings.set(systemId, mapping);
      
      this.logger.log(`Refreshed ${mapping.tools.length} tools for system ${systemId}`);
    } catch (error: any) {
      this.logger.error(`Failed to refresh tools for system ${systemId}`, error.message);
      throw error;
    }
  }

  getToolsForSystem(systemId: string): JsonRpcTool[] {
    const mapping = this.toolMappings.get(systemId);
    return mapping ? mapping.tools : [];
  }
}