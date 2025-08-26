import { Injectable } from "@nestjs/common";
import { Resolver, Tool } from "@nestjs-mcp/server";
import { z } from "zod";
import { ODataClientService } from "../services/odata-client.service";
import { ODataQueryOptions } from "../types/odata.types";

@Injectable()
@Resolver()
export class ODataResolver {
  constructor(private readonly odataClient: ODataClientService) {}

  @Tool({
    name: "sap_connect",
    description: "Connect to SAP OData service using configured credentials",
  })
  async connect() {
    try {
      const connected = await this.odataClient.connect();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: connected,
              message: connected 
                ? "Successfully connected to SAP OData service" 
                : "Failed to connect to SAP OData service",
              connectionInfo: this.odataClient.getConnectionInfo(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: "Connection failed",
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: "sap_connection_status",
    description: "Get current SAP OData connection status and information",
  })
  getConnectionStatus() {
    const connectionInfo = this.odataClient.getConnectionInfo();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(connectionInfo, null, 2),
        },
      ],
    };
  }

  @Tool({
    name: "sap_get_services",
    description: "Get list of available OData services from the SAP system",
  })
  async getServices() {
    try {
      const serviceList = await this.odataClient.getServices();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              servicesFound: serviceList.services.length,
              source: serviceList.source,
              message: serviceList.message,
              services: serviceList.services,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: "Failed to retrieve services",
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: "sap_get_service_metadata",
    description: "Get metadata for a specific OData service including entities, properties, and functions",
    paramsSchema: {
      serviceName: z.string().describe("The name of the OData service to retrieve metadata for")
    }
  })
  async getServiceMetadata(params: { serviceName: string }) {
    try {
      console.log('=== RESOLVER DEBUG ===');
      console.log('Full params object:', JSON.stringify(params, null, 2));
      console.log('params.serviceName:', params.serviceName);
      console.log('typeof params.serviceName:', typeof params.serviceName);
      console.log('params keys:', Object.keys(params || {}));
      
      const metadata = await this.odataClient.getServiceMetadata(params.serviceName);
      
      const summary = {
        serviceName: params.serviceName,
        entitiesCount: metadata.entities.length,
        functionsCount: metadata.functions.length,
        entitySetsCount: metadata.entitySets.length,
        entities: metadata.entities.map(entity => ({
          name: entity.name,
          propertiesCount: entity.properties.length,
          properties: entity.properties,
        })),
        entitySets: metadata.entitySets,
        functions: metadata.functions,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              metadata: summary,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Failed to retrieve metadata for service ${params.serviceName}`,
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: "sap_query_entity_set",
    description: "Query an entity set from a specific OData service with optional filtering, sorting, and paging",
    paramsSchema: {
      serviceName: z.string().describe("The name of the OData service"),
      entitySetName: z.string().describe("The name of the entity set to query"),
      select: z.array(z.string()).optional().describe("Fields to select"),
      filter: z.string().optional().describe("OData filter expression"),
      orderby: z.string().optional().describe("OData orderby expression"),
      top: z.number().optional().describe("Number of records to return"),
      skip: z.number().optional().describe("Number of records to skip"),
      expand: z.array(z.string()).optional().describe("Related entities to expand")
    }
  })
  async queryEntitySet(params: {
    serviceName: string;
    entitySetName: string;
    select?: string[];
    filter?: string;
    orderby?: string;
    top?: number;
    skip?: number;
    expand?: string[];
  }) {
    try {
      const options: ODataQueryOptions = {
        select: params.select,
        filter: params.filter,
        orderby: params.orderby,
        top: params.top,
        skip: params.skip,
        expand: params.expand,
      };

      const result = await this.odataClient.queryEntitySet(
        params.serviceName,
        params.entitySetName,
        options
      );

      const responseData = result.d?.results || result.d || result;
      const count = Array.isArray(responseData) ? responseData.length : 1;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              serviceName: params.serviceName,
              entitySetName: params.entitySetName,
              recordsReturned: count,
              queryOptions: options,
              data: responseData,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Failed to query entity set ${params.entitySetName} from service ${params.serviceName}`,
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  @Tool({
    name: "sap_disconnect",
    description: "Disconnect from the SAP OData service",
  })
  disconnect() {
    this.odataClient.disconnect();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Disconnected from SAP OData service",
          }, null, 2),
        },
      ],
    };
  }
}