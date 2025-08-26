import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemConfig, AuthenticationType, SystemType, SystemConfigSchema } from '../types/system.types';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);
  private systemConfigs = new Map<string, SystemConfig>();

  constructor(private configService: ConfigService) {
    this.loadSystemsFromEnvironment();
  }

  private loadSystemsFromEnvironment(): void {
    this.logger.log('Loading system configurations from environment...');

    // Load legacy SAP system (for backward compatibility)
    this.loadLegacySAPSystem();

    // Load BTP Catalog system
    this.loadBTPCatalogSystem();

    // Load additional systems (SYSTEM1_, SYSTEM2_, etc.)
    this.loadAdditionalSystems();

    this.logger.log(`Loaded ${this.systemConfigs.size} system configurations`);
  }

  private loadLegacySAPSystem(): void {
    const baseUrl = this.configService.get<string>('SAP_BASE_URL');
    const username = this.configService.get<string>('SAP_USERNAME');
    const password = this.configService.get<string>('SAP_PASSWORD');

    if (baseUrl && username && password) {
      const systemConfig: SystemConfig = {
        id: 'legacy-sap',
        name: 'Legacy SAP System',
        description: 'Legacy SAP OData system with basic authentication',
        type: SystemType.SAP_ONPREMISE,
        baseUrl,
        authType: AuthenticationType.BASIC,
        timeout: parseInt(this.configService.get<string>('SAP_TIMEOUT') || '30000', 10),
        validateSSL: this.configService.get<string>('SAP_VALIDATE_SSL') === 'true',
        enableCSRF: this.configService.get<string>('SAP_ENABLE_CSRF') === 'true',
        basicAuth: {
          username,
          password,
          client: this.configService.get<string>('SAP_CLIENT'),
        },
        metadata: {
          discoveryUrl: `${baseUrl.replace(/\/$/, '')}/sap/bc/rest/backends/catalog/services`,
        },
      };

      this.addSystem(systemConfig);
    }
  }

  private loadBTPCatalogSystem(): void {
    const baseUrl = this.configService.get<string>('CATALOG_ODATA_URL');
    const tokenUrl = this.configService.get<string>('CATALOG_OAUTH_TOKEN_URL');
    const clientId = this.configService.get<string>('CATALOG_OAUTH_CLIENT_ID');
    const clientSecret = this.configService.get<string>('CATALOG_OAUTH_CLIENT_SECRET');

    if (baseUrl && tokenUrl && clientId && clientSecret) {
      const systemConfig: SystemConfig = {
        id: 'btp-catalog',
        name: 'SAP BTP Catalog Service',
        description: 'SAP Business Technology Platform catalog service with OAuth 2.0',
        type: SystemType.BTP,
        baseUrl,
        authType: AuthenticationType.OAUTH2,
        timeout: 30000,
        validateSSL: true,
        enableCSRF: false,
        oauth2: {
          tokenUrl,
          clientId,
          clientSecret,
        },
      };

      this.addSystem(systemConfig);
    }
  }

  private loadAdditionalSystems(): void {
    // Load systems defined with SYSTEM<N>_ prefix
    for (let i = 1; i <= 10; i++) {
      const prefix = `SYSTEM${i}_`;
      const systemConfig = this.loadSystemWithPrefix(prefix, `system-${i}`);
      
      if (systemConfig) {
        this.addSystem(systemConfig);
      }
    }

    // Load systems with custom prefixes (NORTHWIND_, DEMO_, etc.)
    const customPrefixes = ['NORTHWIND_', 'DEMO_', 'TEST_', 'DEV_', 'PROD_'];
    customPrefixes.forEach(prefix => {
      const systemId = prefix.toLowerCase().replace('_', '');
      const systemConfig = this.loadSystemWithPrefix(prefix, systemId);
      
      if (systemConfig) {
        this.addSystem(systemConfig);
      }
    });
  }

  private loadSystemWithPrefix(prefix: string, systemId: string): SystemConfig | null {
    const baseUrl = this.configService.get<string>(`${prefix}BASE_URL`);
    if (!baseUrl) return null;

    const name = this.configService.get<string>(`${prefix}NAME`) || `System ${systemId}`;
    const description = this.configService.get<string>(`${prefix}DESCRIPTION`);
    const type = this.parseSystemType(this.configService.get<string>(`${prefix}TYPE`));
    const authType = this.parseAuthType(this.configService.get<string>(`${prefix}AUTH_TYPE`));

    const systemConfig: SystemConfig = {
      id: systemId,
      name,
      description,
      type,
      baseUrl,
      authType,
      timeout: parseInt(this.configService.get<string>(`${prefix}TIMEOUT`) || '30000', 10),
      validateSSL: this.configService.get<string>(`${prefix}VALIDATE_SSL`) !== 'false',
      enableCSRF: this.configService.get<string>(`${prefix}ENABLE_CSRF`) === 'true',
    };

    // Configure authentication
    if (authType === AuthenticationType.BASIC) {
      const username = this.configService.get<string>(`${prefix}USERNAME`);
      const password = this.configService.get<string>(`${prefix}PASSWORD`);
      
      if (username && password) {
        systemConfig.basicAuth = {
          username,
          password,
          client: this.configService.get<string>(`${prefix}CLIENT`),
        };
      }
    } else if (authType === AuthenticationType.OAUTH2) {
      const tokenUrl = this.configService.get<string>(`${prefix}OAUTH_TOKEN_URL`);
      const clientId = this.configService.get<string>(`${prefix}OAUTH_CLIENT_ID`);
      const clientSecret = this.configService.get<string>(`${prefix}OAUTH_CLIENT_SECRET`);
      
      if (tokenUrl && clientId && clientSecret) {
        systemConfig.oauth2 = {
          tokenUrl,
          clientId,
          clientSecret,
          scope: this.configService.get<string>(`${prefix}OAUTH_SCOPE`),
        };
      }
    }

    // Configure metadata discovery
    const discoveryUrl = this.configService.get<string>(`${prefix}DISCOVERY_URL`);
    if (discoveryUrl) {
      systemConfig.metadata = {
        discoveryUrl,
        customHeaders: this.parseCustomHeaders(this.configService.get<string>(`${prefix}CUSTOM_HEADERS`)),
      };
    }

    return systemConfig;
  }

  private parseSystemType(typeString?: string): SystemType {
    if (!typeString) return SystemType.GENERIC_ODATA;
    
    switch (typeString.toLowerCase()) {
      case 'sap_onpremise':
      case 'sap-onpremise':
      case 'sap_on_premise':
        return SystemType.SAP_ONPREMISE;
      case 'sap_btp':
      case 'sap-btp':
      case 'btp':
        return SystemType.BTP;
      default:
        return SystemType.GENERIC_ODATA;
    }
  }

  private parseAuthType(authString?: string): AuthenticationType {
    if (!authString) return AuthenticationType.NONE;
    
    switch (authString.toLowerCase()) {
      case 'basic':
        return AuthenticationType.BASIC;
      case 'oauth2':
      case 'oauth':
        return AuthenticationType.OAUTH2;
      case 'none':
      case 'anonymous':
        return AuthenticationType.NONE;
      default:
        return AuthenticationType.NONE;
    }
  }

  private parseCustomHeaders(headersString?: string): Record<string, string> | undefined {
    if (!headersString) return undefined;
    
    try {
      return JSON.parse(headersString);
    } catch {
      // Try to parse simple format: "key1=value1,key2=value2"
      const headers: Record<string, string> = {};
      const pairs = headersString.split(',');
      
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          headers[key.trim()] = value.trim();
        }
      }
      
      return Object.keys(headers).length > 0 ? headers : undefined;
    }
  }

  private addSystem(systemConfig: SystemConfig): void {
    try {
      // Validate system configuration
      const validated = SystemConfigSchema.parse(systemConfig);
      
      this.systemConfigs.set(validated.id, validated);
      this.logger.log(`Added system configuration: ${validated.name} (${validated.id})`);
    } catch (error) {
      this.logger.error(`Failed to add system configuration ${systemConfig.id}:`, error);
    }
  }

  // Public methods
  getAllSystems(): SystemConfig[] {
    return Array.from(this.systemConfigs.values());
  }

  getSystem(systemId: string): SystemConfig | undefined {
    return this.systemConfigs.get(systemId);
  }

  getSystemsByType(type: SystemType): SystemConfig[] {
    return this.getAllSystems().filter(system => system.type === type);
  }

  getSystemsByAuthType(authType: AuthenticationType): SystemConfig[] {
    return this.getAllSystems().filter(system => system.authType === authType);
  }

  hasSystem(systemId: string): boolean {
    return this.systemConfigs.has(systemId);
  }

  addRuntimeSystem(systemConfig: SystemConfig): void {
    this.addSystem(systemConfig);
  }

  removeSystem(systemId: string): boolean {
    const removed = this.systemConfigs.delete(systemId);
    if (removed) {
      this.logger.log(`Removed system configuration: ${systemId}`);
    }
    return removed;
  }

  validateSystemConfig(systemConfig: Partial<SystemConfig>): { valid: boolean; errors?: string[] } {
    try {
      SystemConfigSchema.parse(systemConfig);
      return { valid: true };
    } catch (error: any) {
      const errors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [error.message];
      return { valid: false, errors };
    }
  }
}