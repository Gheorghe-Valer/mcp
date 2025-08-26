import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { OAuth2Service } from './oauth.service';
import {
  ODataSystemConfig,
  AuthType,
  ODataQueryOptions,
  ODataMetadata,
  ODataServiceList,
  ConnectionInfo,
} from '../types/odata.types';

@Injectable()
export class MultiODataClientService {
  private readonly logger = new Logger(MultiODataClientService.name);
  private systemConfigs = new Map<string, ODataSystemConfig>();
  private axiosInstances = new Map<string, AxiosInstance>();
  private connectionStates = new Map<string, boolean>();
  private csrfTokens = new Map<string, string>();

  constructor(
    private configService: ConfigService,
    private oauth2Service: OAuth2Service,
  ) {
    this.initializeFromEnvironment();
  }

  private initializeFromEnvironment(): void {
    const catalogServiceConfig: ODataSystemConfig = {
      id: 'catalog-service',
      name: 'SAP Cloud Catalog Service',
      description: 'Books catalog OData service with OAuth 2.0 authentication',
      baseUrl: this.configService.get<string>('CATALOG_ODATA_URL') || '',
      authType: AuthType.OAUTH2,
      timeout: 30000,
      validateSSL: true,
      enableCSRF: false,
      oauth2: {
        tokenUrl: this.configService.get<string>('CATALOG_OAUTH_TOKEN_URL') || '',
        clientId: this.configService.get<string>('CATALOG_OAUTH_CLIENT_ID') || '',
        clientSecret: this.configService.get<string>('CATALOG_OAUTH_CLIENT_SECRET') || '',
      },
    };

    if (catalogServiceConfig.baseUrl && catalogServiceConfig.oauth2?.tokenUrl) {
      this.addSystem(catalogServiceConfig);
    }
  }

  addSystem(config: ODataSystemConfig): void {
    this.systemConfigs.set(config.id, config);
    this.initializeAxiosForSystem(config);
    this.logger.log(`Added OData system: ${config.name} (${config.id})`);
  }

  private initializeAxiosForSystem(config: ODataSystemConfig): void {
    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      httpsAgent: config.validateSSL !== false
        ? undefined
        : new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    axiosInstance.interceptors.request.use(async (axiosConfig) => {
      if (config.authType === AuthType.OAUTH2 && config.oauth2) {
        try {
          const token = await this.oauth2Service.getAccessToken(config.oauth2);
          axiosConfig.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          this.logger.error(`Failed to get OAuth2 token for system ${config.id}`, error);
          throw error;
        }
      } else if (config.authType === AuthType.BASIC && config.basicAuth) {
        axiosConfig.auth = {
          username: config.basicAuth.username,
          password: config.basicAuth.password,
        };
        if (config.basicAuth.client) {
          axiosConfig.headers['sap-client'] = config.basicAuth.client;
        }
      }

      const csrfToken = this.csrfTokens.get(config.id);
      if (csrfToken && config.enableCSRF) {
        axiosConfig.headers['X-CSRF-Token'] = csrfToken;
      }

      return axiosConfig;
    });

    this.axiosInstances.set(config.id, axiosInstance);
  }

  async connect(systemId: string): Promise<boolean> {
    const config = this.systemConfigs.get(systemId);
    if (!config) {
      throw new Error(`System ${systemId} not found`);
    }

    const axiosInstance = this.axiosInstances.get(systemId);
    if (!axiosInstance) {
      throw new Error(`Axios instance for system ${systemId} not initialized`);
    }

    this.logger.log(`Attempting to connect to OData system: ${config.name}`);

    try {
      if (config.enableCSRF) {
        await this.fetchCSRFToken(systemId);
      }

      const response = await axiosInstance.get('/');
      this.connectionStates.set(systemId, response.status === 200);
      this.logger.log(`Successfully connected to ${config.name}`);
    } catch (error: any) {
      this.logger.debug(`Connection test for ${config.name} received status: ${error.response?.status || 'no response'}`);
      
      if (error.response && [200, 401, 403, 404].includes(error.response.status)) {
        this.connectionStates.set(systemId, true);
        this.logger.log(`${config.name} is reachable (HTTP ${error.response.status}). Ready for service discovery.`);
      } else {
        this.logger.error(`Failed to connect to ${config.name}: ${error.message}`);
        this.connectionStates.set(systemId, false);
      }
    }

    return this.connectionStates.get(systemId) || false;
  }

  private async fetchCSRFToken(systemId: string): Promise<void> {
    const axiosInstance = this.axiosInstances.get(systemId);
    const config = this.systemConfigs.get(systemId);
    
    if (!axiosInstance || !config) return;

    try {
      const response = await axiosInstance.get('/', {
        headers: { 'X-CSRF-Token': 'Fetch' },
      });
      const csrfToken = response.headers['x-csrf-token'];
      if (csrfToken) {
        this.csrfTokens.set(systemId, csrfToken);
        this.logger.debug(`CSRF token fetched for system ${systemId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch CSRF token for system ${systemId}`);
    }
  }

  async getServiceMetadata(systemId: string, servicePath?: string): Promise<ODataMetadata> {
    const axiosInstance = this.axiosInstances.get(systemId);
    const config = this.systemConfigs.get(systemId);
    
    if (!axiosInstance || !config) {
      throw new Error(`System ${systemId} not found or not initialized`);
    }

    const isConnected = this.connectionStates.get(systemId);
    if (!isConnected) {
      const connected = await this.connect(systemId);
      if (!connected) {
        throw new Error(`Cannot connect to system ${systemId}`);
      }
    }

    try {
      this.logger.log(`Fetching metadata for system: ${systemId}`);
      
      let metadataUrl = '/$metadata';
      if (servicePath) {
        metadataUrl = `/${servicePath}/$metadata`;
      }

      const response = await axiosInstance.get(metadataUrl, {
        headers: { Accept: 'application/xml' },
      });

      const metadata = this.parseMetadata(response.data);
      this.logger.log(`Parsed metadata for ${systemId}: ${metadata.entities.length} entities, ${metadata.functions.length} functions`);
      
      return metadata;
    } catch (error: any) {
      this.logger.error(`Failed to fetch metadata for system ${systemId}`, error.message);
      throw error;
    }
  }

  private parseMetadata(xmlData: string): ODataMetadata {
    const entities: any[] = [];
    const functions: any[] = [];
    const entitySets: any[] = [];

    try {
      const entityTypeRegex = /<EntityType[^>]*Name="([^"]*)"[^>]*>([\s\S]*?)<\/EntityType>/g;
      const propertyRegex = /<Property[^>]*Name="([^"]*)"[^>]*Type="([^"]*)"[^>]*(?:Nullable="([^"]*)")?[^>]*\/?>/g;
      const functionRegex = /<FunctionImport[^>]*Name="([^"]*)"[^>]*(?:ReturnType="([^"]*)")?[^>]*\/?>/g;
      const entitySetRegex = /<EntitySet[^>]*Name="([^"]*)"[^>]*EntityType="([^"]*)"[^>]*\/?>/g;

      let entityMatch;
      while ((entityMatch = entityTypeRegex.exec(xmlData)) !== null) {
        const entityName = entityMatch[1];
        const entityContent = entityMatch[2];
        const properties: any[] = [];

        let propertyMatch;
        while ((propertyMatch = propertyRegex.exec(entityContent)) !== null) {
          properties.push({
            name: propertyMatch[1],
            type: propertyMatch[2],
            nullable: propertyMatch[3] !== 'false',
          });
        }

        entities.push({
          name: entityName,
          properties,
        });
      }

      let functionMatch;
      while ((functionMatch = functionRegex.exec(xmlData)) !== null) {
        functions.push({
          name: functionMatch[1],
          returnType: functionMatch[2],
        });
      }

      let entitySetMatch;
      while ((entitySetMatch = entitySetRegex.exec(xmlData)) !== null) {
        entitySets.push({
          name: entitySetMatch[1],
          entityType: entitySetMatch[2],
        });
      }
    } catch (error) {
      this.logger.warn('Failed to parse metadata XML, returning raw data');
    }

    return {
      entities,
      functions,
      entitySets,
      raw: xmlData,
    };
  }

  async queryEntitySet(
    systemId: string,
    entitySetName: string,
    options: ODataQueryOptions = {},
    servicePath?: string,
  ): Promise<any> {
    const axiosInstance = this.axiosInstances.get(systemId);
    const config = this.systemConfigs.get(systemId);
    
    if (!axiosInstance || !config) {
      throw new Error(`System ${systemId} not found or not initialized`);
    }

    try {
      let url = `/${entitySetName}`;
      if (servicePath) {
        url = `/${servicePath}/${entitySetName}`;
      }

      const params = new URLSearchParams();

      if (options.select?.length) {
        params.append('$select', options.select.join(','));
      }
      if (options.filter) {
        params.append('$filter', options.filter);
      }
      if (options.orderby) {
        params.append('$orderby', options.orderby);
      }
      if (options.top) {
        params.append('$top', options.top.toString());
      }
      if (options.skip) {
        params.append('$skip', options.skip.toString());
      }
      if (options.expand?.length) {
        params.append('$expand', options.expand.join(','));
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      this.logger.log(`Querying entity set: ${url} on system ${systemId}`);
      const response = await axiosInstance.get(url);
      
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to query entity set ${entitySetName} on system ${systemId}`, error.message);
      throw error;
    }
  }

  getConnectionInfo(systemId: string): ConnectionInfo | null {
    const config = this.systemConfigs.get(systemId);
    const connected = this.connectionStates.get(systemId) || false;
    const hasCSRFToken = this.csrfTokens.has(systemId);

    if (!config) return null;

    return {
      connected,
      baseUrl: config.baseUrl,
      username: config.basicAuth?.username,
      client: config.basicAuth?.client,
      timeout: config.timeout || 30000,
      enableCSRF: config.enableCSRF || false,
      hasCSRFToken,
      authType: config.authType,
      lastConnected: connected ? new Date() : undefined,
    };
  }

  getAllSystems(): ODataSystemConfig[] {
    return Array.from(this.systemConfigs.values());
  }

  getSystem(systemId: string): ODataSystemConfig | undefined {
    return this.systemConfigs.get(systemId);
  }

  disconnect(systemId: string): void {
    this.connectionStates.set(systemId, false);
    this.csrfTokens.delete(systemId);
    this.oauth2Service.clearTokenCache();
    this.logger.log(`Disconnected from system ${systemId}`);
  }

  disconnectAll(): void {
    this.connectionStates.clear();
    this.csrfTokens.clear();
    this.oauth2Service.clearTokenCache();
    this.logger.log('Disconnected from all systems');
  }
}