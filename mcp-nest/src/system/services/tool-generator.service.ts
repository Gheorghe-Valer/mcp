import { Injectable, Logger } from '@nestjs/common';
import {
  ODataService,
  ODataServiceMetadata,
  ODataEntity,
  ODataEntitySet,
  ODataFunction,
  ODataAction,
  ODataProperty,
  GeneratedTool,
  ToolOperation,
  SystemConfig
} from '../types/system.types';

export interface ToolGenerationConfig {
  enabledOperations: string[]; // 'C', 'R', 'U', 'D', 'F', 'S', 'G', 'A'
  toolPrefix?: string;
  toolPostfix?: string;
  useServiceId: boolean;
  shrinkNames: boolean;
  maxToolNameLength: number;
  claudeCodeFriendly: boolean;
}

@Injectable()
export class ToolGeneratorService {
  private readonly logger = new Logger(ToolGeneratorService.name);

  generateToolsForService(
    systemConfig: SystemConfig,
    service: ODataService,
    config: ToolGenerationConfig
  ): GeneratedTool[] {
    const tools: GeneratedTool[] = [];

    if (!service.metadata) {
      this.logger.warn(`No metadata available for service ${service.id}`);
      return tools;
    }

    const serviceId = this.extractServiceId(service.url);

    // Generate entity set tools
    for (const entitySet of service.metadata.entitySets) {
      const entity = service.metadata.entities.find(e => e.name === entitySet.entityType);
      if (!entity) {
        this.logger.warn(`Entity type ${entitySet.entityType} not found for entity set ${entitySet.name}`);
        continue;
      }

      tools.push(...this.generateEntitySetTools(entitySet, entity, serviceId, config));
    }

    // Generate function import tools
    for (const func of service.metadata.functions) {
      tools.push(...this.generateFunctionTools(func, serviceId, config));
    }

    // Generate action tools
    for (const action of service.metadata.actions) {
      tools.push(...this.generateActionTools(action, serviceId, config));
    }

    this.logger.log(`Generated ${tools.length} tools for service ${service.id}`);
    return tools;
  }

  private generateEntitySetTools(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool[] {
    const tools: GeneratedTool[] = [];

    // Expand 'R' (read) operations to 'S', 'F', 'G'
    const expandedOps = this.expandOperations(config.enabledOperations);

    // Filter/List tool
    if (expandedOps.includes('F')) {
      tools.push(this.generateFilterTool(entitySet, entity, serviceId, config));
    }

    // Search tool
    if (expandedOps.includes('S') && entitySet.searchable) {
      tools.push(this.generateSearchTool(entitySet, entity, serviceId, config));
    }

    // Get single entity tool
    if (expandedOps.includes('G')) {
      tools.push(this.generateGetTool(entitySet, entity, serviceId, config));
    }

    // Count tool
    if (expandedOps.includes('F') && entitySet.countable) {
      tools.push(this.generateCountTool(entitySet, entity, serviceId, config));
    }

    // Create tool
    if (expandedOps.includes('C') && entitySet.creatable) {
      tools.push(this.generateCreateTool(entitySet, entity, serviceId, config));
    }

    // Update tool
    if (expandedOps.includes('U') && entitySet.updatable) {
      tools.push(this.generateUpdateTool(entitySet, entity, serviceId, config));
    }

    // Delete tool
    if (expandedOps.includes('D') && entitySet.deletable) {
      tools.push(this.generateDeleteTool(entitySet, entity, serviceId, config));
    }

    return tools;
  }

  private generateFilterTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('filter', entitySet.name, serviceId, config);
    
    return {
      name: toolName,
      description: `Filter and list ${entitySet.name} entities with optional query parameters`,
      operation: ToolOperation.FILTER,
      entitySet: entitySet.name,
      handler: 'handleEntityFilter',
      inputSchema: {
        type: 'object',
        properties: {
          ...this.generateQueryParameterSchema(config.claudeCodeFriendly),
          ...this.generateSelectProperties(entity.properties, config.claudeCodeFriendly),
        },
        required: [],
      },
    };
  }

  private generateSearchTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('search', entitySet.name, serviceId, config);
    
    return {
      name: toolName,
      description: `Search ${entitySet.name} entities using full-text search`,
      operation: ToolOperation.SEARCH,
      entitySet: entitySet.name,
      handler: 'handleEntitySearch',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for full-text search',
          },
          ...this.generateQueryParameterSchema(config.claudeCodeFriendly),
          ...this.generateSelectProperties(entity.properties, config.claudeCodeFriendly),
        },
        required: ['search'],
      },
    };
  }

  private generateGetTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('get', entitySet.name, serviceId, config);
    const keyProperties = this.generateKeyProperties(entity);
    
    return {
      name: toolName,
      description: `Get a single ${entitySet.name} entity by key`,
      operation: ToolOperation.GET,
      entitySet: entitySet.name,
      handler: 'handleEntityGet',
      inputSchema: {
        type: 'object',
        properties: {
          ...keyProperties,
          ...this.generateSelectProperties(entity.properties, config.claudeCodeFriendly),
          expand: {
            type: 'array',
            items: { type: 'string' },
            description: 'Related entities to expand',
          },
        },
        required: Object.keys(keyProperties),
      },
    };
  }

  private generateCountTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('count', entitySet.name, serviceId, config);
    
    return {
      name: toolName,
      description: `Get the count of ${entitySet.name} entities with optional filters`,
      operation: ToolOperation.COUNT,
      entitySet: entitySet.name,
      handler: 'handleEntityCount',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'OData filter expression',
          },
          search: {
            type: 'string',
            description: 'Search term',
          },
        },
        required: [],
      },
    };
  }

  private generateCreateTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('create', entitySet.name, serviceId, config);
    const entityProperties = this.generateEntityProperties(entity.properties, false);
    
    return {
      name: toolName,
      description: `Create a new ${entitySet.name} entity`,
      operation: ToolOperation.CREATE,
      entitySet: entitySet.name,
      handler: 'handleEntityCreate',
      inputSchema: {
        type: 'object',
        properties: entityProperties.properties,
        required: entityProperties.required,
      },
    };
  }

  private generateUpdateTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('update', entitySet.name, serviceId, config);
    const keyProperties = this.generateKeyProperties(entity);
    const entityProperties = this.generateEntityProperties(entity.properties, true);
    
    return {
      name: toolName,
      description: `Update an existing ${entitySet.name} entity`,
      operation: ToolOperation.UPDATE,
      entitySet: entitySet.name,
      handler: 'handleEntityUpdate',
      inputSchema: {
        type: 'object',
        properties: {
          ...keyProperties,
          ...entityProperties.properties,
        },
        required: Object.keys(keyProperties),
      },
    };
  }

  private generateDeleteTool(
    entitySet: ODataEntitySet,
    entity: ODataEntity,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool {
    const toolName = this.buildToolName('delete', entitySet.name, serviceId, config);
    const keyProperties = this.generateKeyProperties(entity);
    
    return {
      name: toolName,
      description: `Delete a ${entitySet.name} entity`,
      operation: ToolOperation.DELETE,
      entitySet: entitySet.name,
      handler: 'handleEntityDelete',
      inputSchema: {
        type: 'object',
        properties: keyProperties,
        required: Object.keys(keyProperties),
      },
    };
  }

  private generateFunctionTools(
    func: ODataFunction,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool[] {
    if (!config.enabledOperations.includes('A')) {
      return [];
    }

    const toolName = this.buildToolName('func', func.name, serviceId, config);
    const parameters = this.generateFunctionParameters(func.parameters);
    
    return [{
      name: toolName,
      description: `Execute function import: ${func.name}`,
      operation: ToolOperation.FUNCTION,
      functionName: func.name,
      handler: 'handleFunctionCall',
      inputSchema: {
        type: 'object',
        properties: parameters.properties,
        required: parameters.required,
      },
    }];
  }

  private generateActionTools(
    action: ODataAction,
    serviceId: string,
    config: ToolGenerationConfig
  ): GeneratedTool[] {
    if (!config.enabledOperations.includes('A')) {
      return [];
    }

    const toolName = this.buildToolName('action', action.name, serviceId, config);
    const parameters = this.generateFunctionParameters(action.parameters);
    
    return [{
      name: toolName,
      description: `Execute action: ${action.name}`,
      operation: ToolOperation.ACTION,
      functionName: action.name,
      handler: 'handleActionCall',
      inputSchema: {
        type: 'object',
        properties: parameters.properties,
        required: parameters.required,
      },
    }];
  }

  private buildToolName(operation: string, entityOrFunction: string, serviceId: string, config: ToolGenerationConfig): string {
    const opName = config.shrinkNames ? this.getShortenedOperation(operation) : operation;
    const servicePart = config.useServiceId ? serviceId : '';
    
    let toolName: string;
    if (config.toolPrefix) {
      toolName = `${config.toolPrefix}_${opName}_${entityOrFunction}${servicePart ? '_' + servicePart : ''}`;
    } else if (config.toolPostfix) {
      toolName = `${opName}_${entityOrFunction}${servicePart ? '_for_' + servicePart : ''}_${config.toolPostfix}`;
    } else {
      // Default: postfix mode with service ID
      toolName = `${opName}_${entityOrFunction}${servicePart ? '_for_' + servicePart : ''}`;
    }

    // Limit length and clean up
    if (toolName.length > config.maxToolNameLength) {
      toolName = toolName.substring(0, config.maxToolNameLength);
    }

    return toolName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  }

  private expandOperations(operations: string[]): string[] {
    const expanded = [...operations];
    
    // Expand 'R' (read) to 'S', 'F', 'G'
    if (expanded.includes('R')) {
      const index = expanded.indexOf('R');
      expanded.splice(index, 1, 'S', 'F', 'G');
    }

    return [...new Set(expanded)]; // Remove duplicates
  }

  private getShortenedOperation(operation: string): string {
    const shortMap: Record<string, string> = {
      filter: 'filter',
      search: 'search',
      get: 'get',
      count: 'count',
      create: 'create',
      update: 'upd',
      delete: 'del',
      func: 'func',
      action: 'action',
    };
    
    return shortMap[operation] || operation;
  }

  private extractServiceId(serviceUrl: string): string {
    // Reuse the logic from Go constants.go FormatServiceID
    // Pattern 1: SAP OData services like /sap/opu/odata/sap/ZODD_000_SRV
    const sapPattern = /\/([A-Z][A-Z0-9_]*_SRV)/;
    const sapMatch = serviceUrl.match(sapPattern);
    if (sapMatch) {
      const svcName = sapMatch[1];
      const compactMatch = svcName.match(/^([A-Z])[A-Z]*_?(\d+)/);
      if (compactMatch) {
        return `${compactMatch[1]}${compactMatch[2]}`;
      }
      return svcName.length > 8 ? svcName.substring(0, 8) : svcName;
    }

    // Pattern 2: .svc endpoints
    const svcPattern = /\/([A-Za-z][A-Za-z0-9_]+)\.svc/;
    const svcMatch = serviceUrl.match(svcPattern);
    if (svcMatch) {
      const name = svcMatch[1];
      return name.length > 5 ? `${name.substring(0, 5)}Svc` : `${name}Svc`;
    }

    // Pattern 3: Generic service name
    const odataPattern = /\/odata\/([A-Za-z][A-Za-z0-9_]+)/;
    const odataMatch = serviceUrl.match(odataPattern);
    if (odataMatch) {
      const name = odataMatch[1];
      return name.length > 8 ? name.substring(0, 8) : name;
    }

    // Extract last meaningful segment
    try {
      const url = new URL(serviceUrl);
      const segments = url.pathname.split('/').filter(s => s && !['api', 'odata', 'sap', 'opu'].includes(s));
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        const cleanSegment = lastSegment.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (cleanSegment.length > 1) {
          return cleanSegment.length > 8 ? cleanSegment.substring(0, 8) : cleanSegment;
        }
      }
    } catch (e) {
      // Invalid URL, continue to fallback
    }

    return 'od'; // Ultimate fallback
  }

  private generateQueryParameterSchema(claudeCodeFriendly: boolean): Record<string, any> {
    const prefix = claudeCodeFriendly ? '' : '$';
    
    return {
      [`${prefix}filter`]: {
        type: 'string',
        description: 'OData filter expression to restrict results',
      },
      [`${prefix}select`]: {
        type: 'array',
        items: { type: 'string' },
        description: 'Select specific properties to return',
      },
      [`${prefix}expand`]: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related entities to expand',
      },
      [`${prefix}orderby`]: {
        type: 'string',
        description: 'Sort expression (e.g., "Name asc, ID desc")',
      },
      [`${prefix}top`]: {
        type: 'integer',
        minimum: 1,
        description: 'Maximum number of results to return',
      },
      [`${prefix}skip`]: {
        type: 'integer',
        minimum: 0,
        description: 'Number of results to skip',
      },
      [`${prefix}count`]: {
        type: 'boolean',
        description: 'Include total count in response',
      },
      [`${prefix}format`]: {
        type: 'string',
        enum: ['json', 'xml'],
        description: 'Response format',
      },
    };
  }

  private generateSelectProperties(properties: ODataProperty[], claudeCodeFriendly: boolean): Record<string, any> {
    const prefix = claudeCodeFriendly ? '' : '$';
    const selectOptions = properties.map(p => p.name);
    
    return {
      [`${prefix}select`]: {
        type: 'array',
        items: {
          type: 'string',
          enum: selectOptions,
        },
        description: 'Select specific properties to return',
      },
    };
  }

  private generateKeyProperties(entity: ODataEntity): Record<string, any> {
    const keyProps: Record<string, any> = {};
    
    for (const keyProp of entity.keyProperties) {
      const property = entity.properties.find(p => p.name === keyProp);
      if (property) {
        keyProps[keyProp] = this.mapODataTypeToJsonSchema(property.type, property);
      }
    }
    
    return keyProps;
  }

  private generateEntityProperties(properties: ODataProperty[], isUpdate: boolean): { properties: Record<string, any>; required: string[] } {
    const props: Record<string, any> = {};
    const required: string[] = [];
    
    for (const property of properties) {
      if (property.isKey && isUpdate) {
        continue; // Skip key properties in update operations
      }
      
      props[property.name] = this.mapODataTypeToJsonSchema(property.type, property);
      
      if (!property.nullable && !isUpdate) {
        required.push(property.name);
      }
    }
    
    return { properties: props, required };
  }

  private generateFunctionParameters(parameters: any[]): { properties: Record<string, any>; required: string[] } {
    const props: Record<string, any> = {};
    const required: string[] = [];
    
    for (const param of parameters) {
      props[param.name] = this.mapODataTypeToJsonSchema(param.type, param);
      
      if (!param.nullable) {
        required.push(param.name);
      }
    }
    
    return { properties: props, required };
  }

  private mapODataTypeToJsonSchema(odataType: string, property?: any): any {
    const baseSchema: any = {
      description: property?.name ? `${property.name} property` : undefined,
    };

    switch (odataType) {
      case 'Edm.String':
        baseSchema.type = 'string';
        if (property?.maxLength) {
          baseSchema.maxLength = property.maxLength;
        }
        break;
      case 'Edm.Int16':
      case 'Edm.Int32':
      case 'Edm.Int64':
      case 'Edm.Byte':
      case 'Edm.SByte':
        baseSchema.type = 'integer';
        break;
      case 'Edm.Single':
      case 'Edm.Double':
      case 'Edm.Decimal':
        baseSchema.type = 'number';
        if (property?.precision) {
          baseSchema.multipleOf = Math.pow(10, -property.scale || 0);
        }
        break;
      case 'Edm.Boolean':
        baseSchema.type = 'boolean';
        break;
      case 'Edm.DateTime':
      case 'Edm.DateTimeOffset':
      case 'Edm.Time':
      case 'Edm.Guid':
      case 'Edm.Binary':
        baseSchema.type = 'string';
        break;
      default:
        baseSchema.type = 'string';
        break;
    }

    if (property?.defaultValue !== undefined) {
      baseSchema.default = property.defaultValue;
    }

    return baseSchema;
  }
}