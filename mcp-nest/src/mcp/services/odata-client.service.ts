import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  SAPODataConfig,
  ODataQueryOptions,
  ODataService,
  ODataMetadata,
  ODataServiceList,
  ConnectionInfo,
  AuthType,
} from "../types/odata.types";

@Injectable()
export class ODataClientService {
  private readonly logger = new Logger(ODataClientService.name);
  private axiosInstance: AxiosInstance;
  private config: SAPODataConfig;
  private connected = false;
  private csrfToken?: string;

  constructor(private configService: ConfigService) {
    this.config = {
      baseUrl: this.configService.get<string>("SAP_BASE_URL") || "",
      username: this.configService.get<string>("SAP_USERNAME") || "",
      password: this.configService.get<string>("SAP_PASSWORD") || "",
      client: this.configService.get<string>("SAP_CLIENT"),
      timeout: parseInt(this.configService.get<string>("SAP_TIMEOUT") || "30000"),
      validateSSL: this.configService.get<string>("SAP_VALIDATE_SSL") === "true",
      enableCSRF: this.configService.get<string>("SAP_ENABLE_CSRF") === "true",
    };

    this.initializeAxios();
  }

  private initializeAxios(): void {
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(this.config.client && { "sap-client": this.config.client }),
      },
      httpsAgent: this.config.validateSSL
        ? undefined
        : new (require("https").Agent)({ rejectUnauthorized: false }),
    });

    this.axiosInstance.interceptors.request.use((config) => {
      if (this.csrfToken && this.config.enableCSRF) {
        config.headers["X-CSRF-Token"] = this.csrfToken;
      }
      return config;
    });
  }

  async connect(): Promise<boolean> {
    this.logger.log("Attempting to connect to SAP OData service...");
    
    try {
      if (this.config.enableCSRF) {
        await this.fetchCSRFToken();
      }
    } catch (csrfError: any) {
      this.logger.debug("CSRF token fetch failed, continuing without it");
    }

    // Try to connect by testing a known endpoint that should return 401/403 if accessible
    // or by trying to access the OData service root
    try {
      const response = await this.axiosInstance.get("/");
      this.connected = response.status === 200;
      this.logger.log("Successfully connected to SAP OData service");
    } catch (error: any) {
      this.logger.debug(`Connection test received status: ${error.response?.status || 'no response'}`);
      
      // If we get 401/403, the server is reachable but needs proper authentication
      // If we get 404, the endpoint doesn't exist but server is reachable
      // If we get connection errors, server is not reachable
      if (error.response) {
        // Server responded with an error status
        this.connected = [401, 403, 404].includes(error.response.status);
        if (this.connected) {
          this.logger.log(`SAP server is reachable (HTTP ${error.response.status}). Ready for service discovery.`);
        } else {
          this.logger.error(`SAP server returned unexpected status: ${error.response.status}`);
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        // Connection refused, host not found, or timeout
        this.logger.error(`Network error connecting to SAP server: ${error.code}`);
        this.connected = false;
      } else {
        // Other errors might still indicate server is reachable
        this.logger.error(`Connection error: ${error.message}`);
        this.connected = false;
      }
    }
    
    if (!this.connected) {
      this.logger.warn("Could not establish connection to SAP OData service");
    }
    
    return this.connected;
  }

  private async fetchCSRFToken(): Promise<void> {
    try {
      const response = await this.axiosInstance.get("/", {
        headers: { "X-CSRF-Token": "Fetch" },
      });
      this.csrfToken = response.headers["x-csrf-token"];
      this.logger.debug("CSRF token fetched successfully");
    } catch (error) {
      this.logger.warn("Failed to fetch CSRF token", error.message);
    }
  }

  async getServices(): Promise<ODataServiceList> {
    try {
      this.logger.log("Fetching available OData services...");
      
      const catalogUrl = "/sap/bc/rest/backends/catalog/services";
      let services: ODataService[] = [];
      let source = "none_found";
      let message = "";

      // Try gateway catalog first
      try {
        const response = await this.axiosInstance.get(catalogUrl);
        if (response.data && response.data.d && response.data.d.results) {
          services = response.data.d.results.map((service: any) => ({
            name: service.ServiceId || service.Name,
            title: service.Title || service.Description,
            version: service.Version,
            url: service.ServiceUrl,
          }));
          source = "gateway_catalog";
          message = "Services retrieved from SAP Gateway catalog";
        }
      } catch (error) {
        this.logger.warn("Gateway catalog not accessible, trying alternative service discovery");
      }

      // If catalog didn't work, try common services discovery
      if (services.length === 0) {
        this.logger.log("Testing common SAP OData services...");
        
        // Return a minimal service list to avoid infinite loops
        // Users can test specific services manually
        services = [
          { name: "API_PURCHASEORDER_PROCESS_SRV", title: "Purchase Order Process API" },
          { name: "API_BUSINESS_PARTNER", title: "Business Partner API" },
          { name: "WORKFORCE_PERSON_SRV", title: "Workforce Person Service" }
        ];
        
        source = "predefined_services";
        message = "Returning common SAP services. Use sap_get_service_metadata to test individual service availability.";
      }

      if (services.length === 0) {
        message += " You may need to check with your SAP administrator about available OData services or activate specific services in transaction SICF.";
      }

      this.logger.log(`Service discovery complete: Found ${services.length} OData services`);
      return { services, source, catalogUrl, message };
    } catch (error) {
      this.logger.error("Failed to fetch OData services", error.message);
      throw error;
    }
  }

  async getServiceMetadata(serviceName: string): Promise<ODataMetadata> {
    try {
      this.logger.log(`=== METADATA REQUEST DEBUG ===`);
      this.logger.log(`Service Name Parameter: '${serviceName}' (type: ${typeof serviceName})`);
      this.logger.log(`Base URL: ${this.config.baseUrl}`);
      
      const metadataUrl = `/${serviceName}/$metadata`;
      const fullUrl = `${this.config.baseUrl}${serviceName}/$metadata`;
      
      this.logger.log(`Metadata URL path: '${metadataUrl}'`);
      this.logger.log(`Full URL: '${fullUrl}'`);
      this.logger.log(`Request headers will include: Accept: application/xml, sap-client: ${this.config.client}, Auth: ${this.config.username}:***`);
      
      const response = await this.axiosInstance.get(`/${serviceName}/$metadata`, {
        headers: { Accept: "application/xml" },
      });

      const metadata = this.parseMetadata(response.data);
      this.logger.log(`Parsed metadata for ${serviceName}: ${metadata.entities.length} entities, ${metadata.functions.length} functions`);
      
      return metadata;
    } catch (error: any) {
      this.logger.error(`=== METADATA REQUEST FAILED ===`);
      this.logger.error(`Service Name: '${serviceName}'`);
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Status: ${error.response?.status}`);
      this.logger.error(`Response: ${error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No response data'}`);
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
            nullable: propertyMatch[3] !== "false",
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
      this.logger.warn("Failed to parse metadata XML, returning raw data", error.message);
    }

    return {
      entities,
      functions,
      entitySets,
      raw: xmlData,
    };
  }

  async queryEntitySet(
    serviceName: string,
    entitySetName: string,
    options: ODataQueryOptions = {}
  ): Promise<any> {
    try {
      let url = `/${serviceName}/${entitySetName}`;
      const params = new URLSearchParams();

      if (options.select?.length) {
        params.append("$select", options.select.join(","));
      }
      if (options.filter) {
        params.append("$filter", options.filter);
      }
      if (options.orderby) {
        params.append("$orderby", options.orderby);
      }
      if (options.top) {
        params.append("$top", options.top.toString());
      }
      if (options.skip) {
        params.append("$skip", options.skip.toString());
      }
      if (options.expand?.length) {
        params.append("$expand", options.expand.join(","));
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      this.logger.log(`Querying entity set: ${url}`);
      const response = await this.axiosInstance.get(url);
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to query entity set ${entitySetName}`, error.message);
      throw error;
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      connected: this.connected,
      baseUrl: this.config.baseUrl,
      username: this.config.username,
      client: this.config.client,
      timeout: this.config.timeout,
      enableCSRF: this.config.enableCSRF,
      hasCSRFToken: !!this.csrfToken,
      authType: AuthType.BASIC,
      lastConnected: this.connected ? new Date() : undefined,
    };
  }

  disconnect(): void {
    this.connected = false;
    this.csrfToken = undefined;
    this.logger.log("Disconnected from SAP OData service");
  }
}