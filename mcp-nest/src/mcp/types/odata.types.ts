import { z } from "zod";

export const SAPODataConfigSchema = z.object({
  baseUrl: z.string().describe("SAP OData service base URL"),
  username: z.string().describe("SAP username"),
  password: z.string().describe("SAP password"),
  client: z.string().optional().describe("SAP client number"),
  timeout: z.number().default(30000).describe("Request timeout"),
  validateSSL: z.boolean().default(true).describe("Validate SSL certificates"),
  enableCSRF: z.boolean().default(true).describe("Enable CSRF token handling"),
});

export type SAPODataConfig = z.infer<typeof SAPODataConfigSchema>;

export enum AuthType {
  BASIC = 'basic',
  OAUTH2 = 'oauth2',
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface ODataSystemConfig {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  authType: AuthType;
  timeout?: number;
  validateSSL?: boolean;
  enableCSRF?: boolean;
  basicAuth?: {
    username: string;
    password: string;
    client?: string;
  };
  oauth2?: OAuth2Config;
}

export interface ODataQueryOptions {
  select?: string[];
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string[];
}

export interface ODataService {
  name: string;
  title: string;
  version?: string;
  url?: string;
}

export interface ODataEntity {
  name: string;
  properties: ODataProperty[];
}

export interface ODataProperty {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ODataFunction {
  name: string;
  returnType?: string;
  parameters?: ODataParameter[];
}

export interface ODataParameter {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ODataMetadata {
  entities: ODataEntity[];
  functions: ODataFunction[];
  entitySets: ODataEntitySet[];
  raw?: any;
}

export interface ODataEntitySet {
  name: string;
  entityType: string;
}

export interface ODataServiceList {
  services: ODataService[];
  source?: 'gateway_catalog' | 'common_services_test' | 'none_found' | string;
  catalogUrl?: string;
  message?: string;
  raw?: any;
}

export interface ConnectionInfo {
  connected: boolean;
  baseUrl: string;
  username?: string;
  client?: string;
  timeout: number;
  enableCSRF: boolean;
  hasCSRFToken: boolean;
  authType: AuthType;
  lastConnected?: Date;
}

export interface JsonRpcTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ODataToJsonRpcMapping {
  systemId: string;
  tools: JsonRpcTool[];
}