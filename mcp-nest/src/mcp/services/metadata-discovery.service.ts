import { Injectable, Logger } from '@nestjs/common';
import { MultiODataClientService } from './multi-odata-client.service';
import {
  ODataMetadata,
  ODataEntity,
  ODataEntitySet,
  JsonRpcTool,
  ODataToJsonRpcMapping,
} from '../types/odata.types';

@Injectable()
export class MetadataDiscoveryService {
  private readonly logger = new Logger(MetadataDiscoveryService.name);

  constructor(private multiODataClient: MultiODataClientService) {}

  async discoverSystemMetadata(systemId: string, servicePath?: string): Promise<ODataMetadata> {
    this.logger.log(`Starting metadata discovery for system: ${systemId}`);
    
    try {
      const metadata = await this.multiODataClient.getServiceMetadata(systemId, servicePath);
      this.logger.log(`Discovered ${metadata.entities.length} entities and ${metadata.entitySets.length} entity sets`);
      
      return metadata;
    } catch (error: any) {
      this.logger.error(`Failed to discover metadata for system ${systemId}`, error.message);
      throw error;
    }
  }

  async generateJsonRpcTools(systemId: string, servicePath?: string): Promise<ODataToJsonRpcMapping> {
    this.logger.log(`Generating JSON-RPC tools for system: ${systemId}`);
    
    const metadata = await this.discoverSystemMetadata(systemId, servicePath);
    const tools: JsonRpcTool[] = [];

    tools.push({
      name: `${systemId}_get_metadata`,
      description: `Get metadata information for the ${systemId} OData service`,
      inputSchema: {
        type: 'object',
        properties: {
          includeRaw: {
            type: 'boolean',
            description: 'Include raw metadata XML in response',
            default: false,
          },
        },
      },
    });

    tools.push({
      name: `${systemId}_list_entities`,
      description: `List all available entities in the ${systemId} OData service`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    });

    tools.push({
      name: `${systemId}_list_entity_sets`,
      description: `List all available entity sets in the ${systemId} OData service`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    });

    for (const entitySet of metadata.entitySets) {
      const entity = metadata.entities.find(e => e.name === entitySet.entityType.split('.').pop());
      
      tools.push({
        name: `${systemId}_query_${entitySet.name.toLowerCase()}`,
        description: `Query the ${entitySet.name} entity set from ${systemId}`,
        inputSchema: this.generateEntityQuerySchema(entity, entitySet),
      });

      tools.push({
        name: `${systemId}_get_${entitySet.name.toLowerCase()}_schema`,
        description: `Get the schema definition for the ${entitySet.name} entity set`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }

    if (metadata.functions.length > 0) {
      tools.push({
        name: `${systemId}_list_functions`,
        description: `List all available functions in the ${systemId} OData service`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }

    this.logger.log(`Generated ${tools.length} JSON-RPC tools for system ${systemId}`);
    
    return {
      systemId,
      tools,
    };
  }

  private generateEntityQuerySchema(entity: ODataEntity | undefined, entitySet: ODataEntitySet): any {
    const schema: any = {
      type: 'object',
      properties: {
        select: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to select (OData $select)',
        },
        filter: {
          type: 'string',
          description: 'Filter expression (OData $filter)',
        },
        orderby: {
          type: 'string',
          description: 'Order by expression (OData $orderby)',
        },
        top: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum number of records to return (OData $top)',
        },
        skip: {
          type: 'integer',
          minimum: 0,
          description: 'Number of records to skip (OData $skip)',
        },
        expand: {
          type: 'array',
          items: { type: 'string' },
          description: 'Navigation properties to expand (OData $expand)',
        },
      },
    };

    if (entity) {
      const availableFields = entity.properties.map(p => p.name);
      schema.properties.select.description += `. Available fields: ${availableFields.join(', ')}`;
      
      const keyFields = entity.properties
        .filter(p => p.name.toLowerCase().includes('id') || p.name.toLowerCase().includes('key'))
        .map(p => p.name);
      
      if (keyFields.length > 0) {
        schema.properties.key = {
          type: 'string',
          description: `Key field value for single record retrieval. Available key fields: ${keyFields.join(', ')}`,
        };
      }

      const exampleFilters = this.generateExampleFilters(entity);
      if (exampleFilters.length > 0) {
        schema.properties.filter.description += `. Examples: ${exampleFilters.join(', ')}`;
      }
    }

    return schema;
  }

  private generateExampleFilters(entity: ODataEntity): string[] {
    const examples: string[] = [];
    
    const stringFields = entity.properties.filter(p => 
      p.type.includes('String') || p.type.includes('string')
    );
    const numberFields = entity.properties.filter(p => 
      p.type.includes('Int') || p.type.includes('Decimal') || p.type.includes('Double')
    );
    const dateFields = entity.properties.filter(p => 
      p.type.includes('Date') || p.type.includes('Time')
    );

    if (stringFields.length > 0) {
      const field = stringFields[0];
      examples.push(`${field.name} eq 'value'`);
      examples.push(`startswith(${field.name}, 'prefix')`);
    }

    if (numberFields.length > 0) {
      const field = numberFields[0];
      examples.push(`${field.name} gt 100`);
    }

    if (dateFields.length > 0) {
      const field = dateFields[0];
      examples.push(`${field.name} ge 2023-01-01T00:00:00Z`);
    }

    return examples.slice(0, 3);
  }

  async discoverAllSystemsMetadata(): Promise<Map<string, ODataToJsonRpcMapping>> {
    const systems = this.multiODataClient.getAllSystems();
    const mappings = new Map<string, ODataToJsonRpcMapping>();

    for (const system of systems) {
      try {
        this.logger.log(`Discovering metadata for system: ${system.name}`);
        const mapping = await this.generateJsonRpcTools(system.id);
        mappings.set(system.id, mapping);
      } catch (error: any) {
        this.logger.error(`Failed to discover metadata for system ${system.id}`, error.message);
      }
    }

    this.logger.log(`Completed metadata discovery for ${mappings.size} systems`);
    return mappings;
  }

  async getEntitySchema(systemId: string, entitySetName: string): Promise<ODataEntity | null> {
    try {
      const metadata = await this.multiODataClient.getServiceMetadata(systemId);
      const entitySet = metadata.entitySets.find(es => 
        es.name.toLowerCase() === entitySetName.toLowerCase()
      );
      
      if (!entitySet) {
        return null;
      }

      const entityTypeName = entitySet.entityType.split('.').pop();
      const entity = metadata.entities.find(e => e.name === entityTypeName);
      
      return entity || null;
    } catch (error: any) {
      this.logger.error(`Failed to get entity schema for ${entitySetName} in system ${systemId}`, error.message);
      throw error;
    }
  }

  formatMetadataForMcp(metadata: ODataMetadata): any {
    return {
      summary: {
        entitiesCount: metadata.entities.length,
        entitySetsCount: metadata.entitySets.length,
        functionsCount: metadata.functions.length,
      },
      entities: metadata.entities.map(entity => ({
        name: entity.name,
        properties: entity.properties.map(prop => ({
          name: prop.name,
          type: prop.type,
          nullable: prop.nullable,
        })),
      })),
      entitySets: metadata.entitySets.map(entitySet => ({
        name: entitySet.name,
        entityType: entitySet.entityType,
      })),
      functions: metadata.functions.map(func => ({
        name: func.name,
        returnType: func.returnType,
      })),
    };
  }
}