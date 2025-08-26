import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { SystemConfig, AuthenticationType, SystemType, SystemConnectionInfo, ODataQueryOptions, ODataQueryResult, ToolOperation, ODataService } from '../types/system.types';
import { OAuth2Service } from '../../mcp/services/oauth.service';
import { MetadataParserService } from './metadata-parser.service';

@Injectable()
export class UniversalSystemClientService {
  private readonly logger = new Logger(UniversalSystemClientService.name);
  private axiosInstances = new Map<string, AxiosInstance>();
  private connectionStates = new Map<string, SystemConnectionInfo>();
  private csrfTokens = new Map<string, string>();

  constructor(
    private oauth2Service: OAuth2Service,
    private metadataParser: MetadataParserService
  ) {}

  async connect(systemConfig: SystemConfig): Promise<boolean> {
    this.logger.log(`Connecting to system: ${systemConfig.name} (${systemConfig.id})`);

    try {
      // Create axios instance for this system
      const axiosInstance = this.createAxiosInstance(systemConfig);
      this.axiosInstances.set(systemConfig.id, axiosInstance);

      // Test connection
      const connected = await this.testConnection(systemConfig);
      
      // Update connection state
      const connectionInfo: SystemConnectionInfo = {
        systemId: systemConfig.id,
        connected,
        lastConnected: connected ? new Date() : undefined,
        lastError: connected ? undefined : 'Connection test failed',
        connectionDetails: {
          baseUrl: systemConfig.baseUrl,
          authType: systemConfig.authType,
          timeout: systemConfig.timeout || 30000,
          validateSSL: systemConfig.validateSSL !== false,
          enableCSRF: systemConfig.enableCSRF || false,
        },
      };

      this.connectionStates.set(systemConfig.id, connectionInfo);
      
      if (connected) {
        this.logger.log(`Successfully connected to ${systemConfig.name}`);
        
        // Fetch CSRF token if needed
        if (systemConfig.enableCSRF) {
          await this.fetchCSRFToken(systemConfig);
        }
      } else {
        this.logger.warn(`Failed to connect to ${systemConfig.name}`);
      }

      return connected;
    } catch (error: any) {
      this.logger.error(`Connection failed for ${systemConfig.name}:`, error.message);
      
      const connectionInfo: SystemConnectionInfo = {
        systemId: systemConfig.id,
        connected: false,
        lastError: error.message,
        connectionDetails: {
          baseUrl: systemConfig.baseUrl,
          authType: systemConfig.authType,
          timeout: systemConfig.timeout || 30000,
          validateSSL: systemConfig.validateSSL !== false,
          enableCSRF: systemConfig.enableCSRF || false,
        },
      };
      
      this.connectionStates.set(systemConfig.id, connectionInfo);
      return false;
    }
  }

  private createAxiosInstance(systemConfig: SystemConfig): AxiosInstance {
    const axiosConfig: any = {
      baseURL: systemConfig.baseUrl,
      timeout: systemConfig.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Universal-OData-MCP-Client/1.0',
      },
    };

    // Configure SSL validation
    if (systemConfig.validateSSL === false) {
      axiosConfig.httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: false,
      });
    }

    // Add custom headers if specified
    if (systemConfig.metadata?.customHeaders) {
      Object.assign(axiosConfig.headers, systemConfig.metadata.customHeaders);
    }

    const instance = axios.create(axiosConfig);

    // Configure authentication interceptor
    instance.interceptors.request.use(async (config) => {
      return await this.configureAuthentication(config, systemConfig);
    });

    // Response interceptor for error handling
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle specific error cases (CSRF, auth failures, etc.)
        if (error.response?.status === 401 && systemConfig.authType === AuthenticationType.OAUTH2) {
          // Try to refresh OAuth token
          this.logger.debug(`Token might be expired for ${systemConfig.id}, clearing cache`);
          if (systemConfig.oauth2) {
            this.oauth2Service.clearTokenCache(systemConfig.oauth2);
          }
        }
        
        if (error.response?.status === 403 && systemConfig.enableCSRF) {
          // CSRF token might be invalid, try to refetch
          this.logger.debug(`CSRF token might be invalid for ${systemConfig.id}, fetching new one`);
          await this.fetchCSRFToken(systemConfig);
        }

        return Promise.reject(error);
      }
    );

    return instance;
  }

  private async configureAuthentication(config: InternalAxiosRequestConfig, systemConfig: SystemConfig): Promise<InternalAxiosRequestConfig> {
    switch (systemConfig.authType) {
      case AuthenticationType.BASIC:
        if (systemConfig.basicAuth) {
          config.auth = {
            username: systemConfig.basicAuth.username,
            password: systemConfig.basicAuth.password,
          };
          
          // Add SAP client header if specified
          if (systemConfig.basicAuth.client) {
            config.headers = config.headers || {};
            config.headers['sap-client'] = systemConfig.basicAuth.client;
          }
        }
        break;

      case AuthenticationType.OAUTH2:
        if (systemConfig.oauth2) {
          try {
            const token = await this.oauth2Service.getAccessToken(systemConfig.oauth2);
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
          } catch (error) {
            this.logger.error(`Failed to get OAuth2 token for ${systemConfig.id}:`, error);
            throw error;
          }
        }
        break;

      case AuthenticationType.NONE:
        // No authentication required
        break;
    }

    // Add CSRF token if available
    const csrfToken = this.csrfTokens.get(systemConfig.id);
    if (csrfToken && systemConfig.enableCSRF) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  }

  private async testConnection(systemConfig: SystemConfig): Promise<boolean> {
    const axiosInstance = this.axiosInstances.get(systemConfig.id);
    if (!axiosInstance) return false;

    try {
      // Try to access the service document or metadata
      await axiosInstance.get('/', { timeout: 5000 });
      return true;
    } catch (error) {
      this.logger.debug(`Connection test failed for ${systemConfig.id}:`, error);
      return false;
    }
  }

  private async fetchCSRFToken(systemConfig: SystemConfig): Promise<void> {
    const axiosInstance = this.axiosInstances.get(systemConfig.id);
    if (!axiosInstance) return;

    try {
      const response = await axiosInstance.get('/', {
        headers: { 'X-CSRF-Token': 'Fetch' },
      });

      const csrfToken = response.headers['x-csrf-token'];
      if (csrfToken) {
        this.csrfTokens.set(systemConfig.id, csrfToken);
        this.logger.debug(`CSRF token fetched for ${systemConfig.id}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to fetch CSRF token for ${systemConfig.id}:`, error);
    }
  }

  async discoverServices(systemConfig: SystemConfig): Promise<ODataService[]> {
    this.logger.log(`Discovering services for system: ${systemConfig.name}`);

    const axiosInstance = this.axiosInstances.get(systemConfig.id);
    if (!axiosInstance) {
      throw new Error(`System ${systemConfig.id} not connected`);
    }

    try {
      switch (systemConfig.type) {
        case SystemType.SAP_ONPREMISE:
          return await this.discoverSAPServices(axiosInstance, systemConfig);
        
        case SystemType.BTP:
          return await this.discoverBTPServices(axiosInstance, systemConfig);
        
        default:
          return await this.discoverGenericServices(axiosInstance, systemConfig);
      }
    } catch (error: any) {
      this.logger.error(`Service discovery failed for ${systemConfig.id}:`, error.message);
      throw error;
    }
  }

  private async discoverSAPServices(axiosInstance: AxiosInstance, systemConfig: SystemConfig): Promise<ODataService[]> {
    try {
      // Try SAP Gateway catalog
      const catalogUrl = systemConfig.metadata?.discoveryUrl || '/sap/bc/rest/backends/catalog/services';
      const response = await axiosInstance.get(catalogUrl);
      
      if (response.data?.d?.results) {
        return response.data.d.results.map((service: any) => ({
          id: service.ServiceId || service.Name,
          name: service.ServiceId || service.Name,
          title: service.Title || service.Description,
          version: service.Version,
          url: service.ServiceUrl || `${systemConfig.baseUrl}/${service.ServiceId}`,
        }));
      }
    } catch (error) {
      this.logger.warn('Gateway catalog not accessible, using fallback');
    }

    // Fallback: Return common SAP services
    return [
      { id: 'API_BUSINESS_PARTNER', name: 'API_BUSINESS_PARTNER', title: 'Business Partner API', url: `${systemConfig.baseUrl}/API_BUSINESS_PARTNER` },
      { id: 'API_PURCHASEORDER_PROCESS_SRV', name: 'API_PURCHASEORDER_PROCESS_SRV', title: 'Purchase Order Process API', url: `${systemConfig.baseUrl}/API_PURCHASEORDER_PROCESS_SRV` },
      { id: 'WORKFORCE_PERSON_SRV', name: 'WORKFORCE_PERSON_SRV', title: 'Workforce Person Service', url: `${systemConfig.baseUrl}/WORKFORCE_PERSON_SRV` }
    ];
  }

  private async discoverBTPServices(axiosInstance: AxiosInstance, systemConfig: SystemConfig): Promise<ODataService[]> {
    // For BTP, we typically have direct service URLs
    // Return the base service as discovered
    return [{
      id: 'btp-service',
      name: 'BTP Service',
      title: 'SAP BTP OData Service',
      url: systemConfig.baseUrl,
    }];
  }

  private async discoverGenericServices(axiosInstance: AxiosInstance, systemConfig: SystemConfig): Promise<ODataService[]> {
    // For generic OData services, try to access service document
    try {
      const response = await axiosInstance.get('/', {
        headers: { 'Accept': 'application/json,application/xml' }
      });
      
      // Parse service document if available
      if (response.data) {
        return [{
          id: 'main-service',
          name: 'Main Service',
          title: 'OData Service',
          url: systemConfig.baseUrl,
        }];
      }
    } catch (error) {
      // Ignore errors, just return the base service
    }

    return [{
      id: 'odata-service',
      name: 'OData Service',
      title: 'Generic OData Service',
      url: systemConfig.baseUrl,
    }];
  }

  async getServiceMetadata(systemConfig: SystemConfig, serviceUrl: string): Promise<ODataService> {
    this.logger.log(`Fetching metadata for service: ${serviceUrl}`);

    const axiosInstance = this.axiosInstances.get(systemConfig.id);
    if (!axiosInstance) {
      throw new Error(`System ${systemConfig.id} not connected`);
    }

    try {
      // Construct metadata URL
      const metadataUrl = serviceUrl.endsWith('/') ? `${serviceUrl}$metadata` : `${serviceUrl}/$metadata`;
      
      const response = await axiosInstance.get(metadataUrl, {
        headers: { 'Accept': 'application/xml,text/xml' }
      });

      if (!response.data) {
        throw new Error('No metadata received');
      }

      const metadata = this.metadataParser.parseMetadata(response.data);
      
      const service: ODataService = {
        id: this.extractServiceId(serviceUrl),
        name: this.extractServiceName(serviceUrl),
        title: `OData Service`,
        url: serviceUrl,
        metadata,
      };

      this.logger.log(`Successfully parsed metadata: ${metadata.entities.length} entities, ${metadata.entitySets.length} entity sets`);
      return service;
    } catch (error: any) {
      this.logger.error(`Failed to fetch metadata for ${serviceUrl}:`, error.message);
      throw error;
    }
  }

  private extractServiceId(serviceUrl: string): string {
    // Extract service ID from URL for naming
    try {
      const url = new URL(serviceUrl);
      const segments = url.pathname.split('/').filter(s => s);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        return lastSegment.replace(/[^a-zA-Z0-9_]/g, '_');
      }
    } catch (e) {
      // Invalid URL, use fallback
    }
    return 'service';
  }

  private extractServiceName(serviceUrl: string): string {
    const serviceId = this.extractServiceId(serviceUrl);
    return serviceId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  async executeQuery(
    systemConfig: SystemConfig,
    entitySetName: string,
    options: ODataQueryOptions = {},
    servicePath?: string
  ): Promise<ODataQueryResult> {
    const axiosInstance = this.axiosInstances.get(systemConfig.id);
    if (!axiosInstance) {
      throw new Error(`System ${systemConfig.id} not connected`);
    }

    const startTime = Date.now();
    let url = servicePath ? `/${servicePath}/${entitySetName}` : `/${entitySetName}`;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (options.select?.length) params.append('$select', options.select.join(','));
    if (options.filter) params.append('$filter', options.filter);
    if (options.orderby) params.append('$orderby', options.orderby);
    if (options.top) params.append('$top', options.top.toString());
    if (options.skip) params.append('$skip', options.skip.toString());
    if (options.expand?.length) params.append('$expand', options.expand.join(','));
    if (options.count) params.append('$count', 'true');
    if (options.search) params.append('$search', options.search);
    if (options.format) params.append('$format', options.format);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    try {
      this.logger.debug(`Executing query: ${url} on system ${systemConfig.id}`);
      const response = await axiosInstance.get(url);
      const executionTime = Date.now() - startTime;

      const result: ODataQueryResult = {
        data: response.data,
        metadata: {
          systemId: systemConfig.id,
          serviceId: servicePath || 'default',
          entitySet: entitySetName,
          operation: ToolOperation.FILTER,
          queryOptions: options,
          executionTime,
          timestamp: new Date().toISOString(),
        },
      };

      // Extract count and next link if available
      if (response.data) {
        if (response.data.d) {
          result.data = response.data.d.results || response.data.d;
          if (response.data.d.__count !== undefined) {
            result.count = parseInt(response.data.d.__count);
          }
          if (response.data.d.__next) {
            result.nextLink = response.data.d.__next;
          }
        } else if (response.data.value) {
          result.data = response.data.value;
          if (response.data['@odata.count'] !== undefined) {
            result.count = response.data['@odata.count'];
          }
          if (response.data['@odata.nextLink']) {
            result.nextLink = response.data['@odata.nextLink'];
          }
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Query execution failed for ${entitySetName} on system ${systemConfig.id}:`, error.message);
      throw error;
    }
  }

  getConnectionInfo(systemId: string): SystemConnectionInfo | undefined {
    return this.connectionStates.get(systemId);
  }

  disconnect(systemId: string): void {
    this.axiosInstances.delete(systemId);
    this.csrfTokens.delete(systemId);
    
    const connectionInfo = this.connectionStates.get(systemId);
    if (connectionInfo) {
      connectionInfo.connected = false;
      this.connectionStates.set(systemId, connectionInfo);
    }
    
    this.logger.log(`Disconnected from system ${systemId}`);
  }

  disconnectAll(): void {
    this.axiosInstances.clear();
    this.csrfTokens.clear();
    this.connectionStates.clear();
    this.oauth2Service.clearTokenCache();
    this.logger.log('Disconnected from all systems');
  }
}