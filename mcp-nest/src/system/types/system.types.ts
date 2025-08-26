import { z } from 'zod';

export enum AuthenticationType {
  NONE = 'none',
  BASIC = 'basic',
  OAUTH2 = 'oauth2',
}

export enum SystemType {
  SAP_ONPREMISE = 'sap_onpremise',
  BTP = 'btp',
  GENERIC_ODATA = 'generic_odata',
}

export interface BasicAuthConfig {
  username: string;
  password: string;
  client?: string; // SAP client number
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface SystemConfig {
  id: string;
  name: string;
  description?: string;
  type: SystemType;
  baseUrl: string;
  authType: AuthenticationType;
  timeout?: number;
  validateSSL?: boolean;
  enableCSRF?: boolean;
  basicAuth?: BasicAuthConfig;
  oauth2?: OAuth2Config;
  metadata?: {
    discoveryUrl?: string; // For service catalog discovery
    customHeaders?: Record<string, string>;
  };
}

export interface ODataService {
  id: string;
  name: string;
  title?: string;
  description?: string;
  version?: string;
  url: string;
  metadata?: ODataServiceMetadata;
}

export interface ODataServiceMetadata {
  entities: ODataEntity[];
  entitySets: ODataEntitySet[];
  functions: ODataFunction[];
  actions: ODataAction[];
  version?: string; // OData version (2.0, 4.0)
  raw?: string; // Raw XML metadata
}

export interface ODataEntity {
  name: string;
  namespace?: string;
  properties: ODataProperty[];
  keyProperties: string[];
  navigationProperties?: ODataNavigationProperty[];
}

export interface ODataProperty {
  name: string;
  type: string;
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  defaultValue?: any;
  isKey?: boolean;
}

export interface ODataNavigationProperty {
  name: string;
  relationship: string;
  fromRole: string;
  toRole: string;
  multiplicity?: string;
}

export interface ODataEntitySet {
  name: string;
  entityType: string;
  creatable?: boolean;
  updatable?: boolean;
  deletable?: boolean;
  searchable?: boolean;
  countable?: boolean;
}

export interface ODataFunction {
  name: string;
  returnType?: string;
  parameters: ODataParameter[];
  httpMethod?: string;
}

export interface ODataAction {
  name: string;
  returnType?: string;
  parameters: ODataParameter[];
}

export interface ODataParameter {
  name: string;
  type: string;
  nullable: boolean;
  mode?: 'In' | 'Out' | 'InOut';
}

export interface ODataQueryOptions {
  select?: string[];
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string[];
  count?: boolean;
  search?: string;
  format?: string;
}

export interface SystemConnectionInfo {
  systemId: string;
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  connectionDetails: {
    baseUrl: string;
    authType: AuthenticationType;
    timeout: number;
    validateSSL: boolean;
    enableCSRF: boolean;
  };
  capabilities?: {
    supportsSearch: boolean;
    supportsCount: boolean;
    supportsCSRF: boolean;
    maxPageSize?: number;
  };
}

export interface ServiceDiscoveryResult {
  systemId: string;
  services: ODataService[];
  discoveryMethod: 'catalog' | 'metadata' | 'manual';
  totalServices: number;
  errors?: string[];
}

export interface ToolGenerationResult {
  systemId: string;
  serviceId: string;
  tools: GeneratedTool[];
}

export interface GeneratedTool {
  name: string;
  description: string;
  operation: ToolOperation;
  entitySet?: string;
  functionName?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler: string; // Handler function name for execution
}

export enum ToolOperation {
  SERVICE_INFO = 'service_info',
  FILTER = 'filter',
  COUNT = 'count',
  SEARCH = 'search',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  FUNCTION = 'function',
  ACTION = 'action',
}

export interface ODataQueryResult {
  data: any;
  count?: number;
  nextLink?: string;
  metadata: {
    systemId: string;
    serviceId: string;
    entitySet?: string;
    operation: ToolOperation;
    queryOptions?: ODataQueryOptions;
    executionTime?: number;
    timestamp: string;
  };
}

// Validation schemas
export const SystemConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(SystemType),
  baseUrl: z.string().url(),
  authType: z.nativeEnum(AuthenticationType),
  timeout: z.number().positive().optional(),
  validateSSL: z.boolean().optional(),
  enableCSRF: z.boolean().optional(),
  basicAuth: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    client: z.string().optional(),
  }).optional(),
  oauth2: z.object({
    tokenUrl: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    scope: z.string().optional(),
  }).optional(),
  metadata: z.object({
    discoveryUrl: z.string().url().optional(),
    customHeaders: z.record(z.string()).optional(),
  }).optional(),
});

export const ODataQueryOptionsSchema = z.object({
  select: z.array(z.string()).optional(),
  filter: z.string().optional(),
  orderby: z.string().optional(),
  top: z.number().positive().optional(),
  skip: z.number().min(0).optional(),
  expand: z.array(z.string()).optional(),
  count: z.boolean().optional(),
  search: z.string().optional(),
  format: z.string().optional(),
});