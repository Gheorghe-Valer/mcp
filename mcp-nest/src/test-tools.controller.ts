import { Controller, Post, Body, Get } from '@nestjs/common';
import { SystemConfigService } from './system/services/system-config.service';
import { UniversalSystemClientService } from './system/services/universal-system-client.service';

@Controller('test-tools')
export class TestToolsController {
  constructor(
    private systemConfig: SystemConfigService,
    private systemClient: UniversalSystemClientService,
  ) {}

  @Get('list-systems')
  async listSystems() {
    try {
      const systems = this.systemConfig.getAllSystems();
      
      return {
        success: true,
        systems: systems.map(system => ({
          id: system.id,
          name: system.name,
          description: system.description,
          baseUrl: system.baseUrl,
          authType: system.authType,
          type: system.type,
          connected: this.systemClient.getConnectionInfo(system.id)?.connected || false,
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

  @Post('system-connect')
  async connectSystem(@Body() body: { systemId: string }) {
    try {
      const systemConfig = this.systemConfig.getSystem(body.systemId);
      if (!systemConfig) {
        return {
          success: false,
          error: `System ${body.systemId} not found`,
        };
      }

      const connected = await this.systemClient.connect(systemConfig);
      const connectionInfo = this.systemClient.getConnectionInfo(body.systemId);

      return {
        success: true,
        systemId: body.systemId,
        systemName: systemConfig.name,
        connected,
        connectionInfo,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('system-get-services')
  async getSystemServices(@Body() body: { systemId: string }) {
    try {
      const systemConfig = this.systemConfig.getSystem(body.systemId);
      if (!systemConfig) {
        return {
          success: false,
          error: `System ${body.systemId} not found`,
        };
      }

      const services = await this.systemClient.discoverServices(systemConfig);

      return {
        success: true,
        systemId: body.systemId,
        systemName: systemConfig.name,
        services: services.map(service => ({
          id: service.id,
          name: service.name,
          title: service.title,
          description: service.description,
          version: service.version,
          url: service.url,
        })),
        total: services.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        services: [],
        total: 0,
      };
    }
  }

  @Post('odata-service-info')
  async getServiceInfo(@Body() body: { systemId: string; serviceUrl: string; includeMetadata?: boolean }) {
    try {
      const systemConfig = this.systemConfig.getSystem(body.systemId);
      if (!systemConfig) {
        return {
          success: false,
          error: `System ${body.systemId} not found`,
        };
      }

      const service = await this.systemClient.getServiceMetadata(systemConfig, body.serviceUrl);
      const metadata = service.metadata;

      const result = {
        success: true,
        systemId: body.systemId,
        systemName: systemConfig.name,
        serviceUrl: body.serviceUrl,
        metadata: {
          entitiesCount: metadata?.entities?.length || 0,
          entitySetsCount: metadata?.entitySets?.length || 0,
          functionsCount: metadata?.functions?.length || 0,
          actionsCount: metadata?.actions?.length || 0,
          version: metadata?.version,
        },
        entities: metadata?.entities?.map((entity: any) => ({
          name: entity.name,
          namespace: entity.namespace,
          keyProperties: entity.keyProperties || [],
          propertiesCount: entity.properties?.length || 0,
          navigationPropertiesCount: entity.navigationProperties?.length || 0,
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
        functions: metadata?.functions?.map((func: any) => ({
          name: func.name,
          returnType: func.returnType,
          parametersCount: func.parameters?.length || 0,
          httpMethod: func.httpMethod,
        })) || [],
        actions: metadata?.actions?.map((action: any) => ({
          name: action.name,
          returnType: action.returnType,
          parametersCount: action.parameters?.length || 0,
        })) || [],
      };

      if (body.includeMetadata) {
        (result as any).rawMetadata = metadata?.raw;
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}