import { Injectable, Logger } from '@nestjs/common';
import { DOMParser } from 'xmldom';
import {
  ODataServiceMetadata,
  ODataEntity,
  ODataEntitySet,
  ODataFunction,
  ODataAction,
  ODataProperty,
  ODataNavigationProperty,
  ODataParameter
} from '../types/system.types';

@Injectable()
export class MetadataParserService {
  private readonly logger = new Logger(MetadataParserService.name);

  parseMetadata(metadataXml: string): ODataServiceMetadata {
    this.logger.debug('Parsing OData metadata XML');

    const parser = new DOMParser();
    const doc = parser.parseFromString(metadataXml, 'text/xml');

    if (!doc || doc.documentElement.tagName === 'parsererror') {
      throw new Error('Invalid XML metadata document');
    }

    const version = this.detectODataVersion(doc);
    this.logger.debug(`Detected OData version: ${version}`);

    const result: ODataServiceMetadata = {
      entities: [],
      entitySets: [],
      functions: [],
      actions: [],
      version,
      raw: metadataXml,
    };

    // Parse based on version
    if (version?.startsWith('4.')) {
      this.parseODataV4(doc, result);
    } else {
      this.parseODataV2(doc, result);
    }

    this.logger.log(`Parsed metadata: ${result.entities.length} entities, ${result.entitySets.length} entity sets, ${result.functions.length} functions`);
    return result;
  }

  private detectODataVersion(doc: Document): string {
    // Check for OData v4 namespace
    const root = doc.documentElement;
    const namespaceUri = root.namespaceURI;
    
    if (namespaceUri?.includes('2007/06/edmx')) {
      return '2.0';
    } else if (namespaceUri?.includes('2009/11/edmx')) {
      return '3.0';
    } else if (namespaceUri?.includes('edm/2006/04') || root.getAttribute('Version') === '4.0') {
      return '4.0';
    }

    // Check version attribute
    const version = root.getAttribute('Version');
    if (version) {
      return version;
    }

    // Default to v2 for legacy systems
    return '2.0';
  }

  private parseODataV2(doc: Document, result: ODataServiceMetadata): void {
    // Find Schema elements
    const schemas = doc.getElementsByTagName('Schema');
    
    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i];
      const namespace = schema.getAttribute('Namespace') || '';

      // Parse EntityTypes
      const entityTypes = schema.getElementsByTagName('EntityType');
      for (let j = 0; j < entityTypes.length; j++) {
        const entityType = entityTypes[j];
        const entity = this.parseEntityType(entityType, namespace);
        if (entity) {
          result.entities.push(entity);
        }
      }

      // Parse EntitySets (from EntityContainer)
      const containers = schema.getElementsByTagName('EntityContainer');
      for (let k = 0; k < containers.length; k++) {
        const container = containers[k];
        const entitySets = container.getElementsByTagName('EntitySet');
        
        for (let l = 0; l < entitySets.length; l++) {
          const entitySet = entitySets[l];
          const entitySetObj = this.parseEntitySet(entitySet);
          if (entitySetObj) {
            result.entitySets.push(entitySetObj);
          }
        }

        // Parse FunctionImports
        const functionImports = container.getElementsByTagName('FunctionImport');
        for (let m = 0; m < functionImports.length; m++) {
          const functionImport = functionImports[m];
          const func = this.parseFunctionImport(functionImport);
          if (func) {
            result.functions.push(func);
          }
        }
      }
    }
  }

  private parseODataV4(doc: Document, result: ODataServiceMetadata): void {
    // V4 has different structure but similar parsing logic
    const schemas = doc.getElementsByTagName('Schema');
    
    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i];
      const namespace = schema.getAttribute('Namespace') || '';

      // Parse EntityTypes
      const entityTypes = schema.getElementsByTagName('EntityType');
      for (let j = 0; j < entityTypes.length; j++) {
        const entityType = entityTypes[j];
        const entity = this.parseEntityType(entityType, namespace);
        if (entity) {
          result.entities.push(entity);
        }
      }

      // Parse EntityContainer
      const containers = schema.getElementsByTagName('EntityContainer');
      for (let k = 0; k < containers.length; k++) {
        const container = containers[k];
        
        // EntitySets
        const entitySets = container.getElementsByTagName('EntitySet');
        for (let l = 0; l < entitySets.length; l++) {
          const entitySet = entitySets[l];
          const entitySetObj = this.parseEntitySet(entitySet);
          if (entitySetObj) {
            result.entitySets.push(entitySetObj);
          }
        }

        // Functions
        const functions = container.getElementsByTagName('Function');
        for (let m = 0; m < functions.length; m++) {
          const func = functions[m];
          const functionObj = this.parseFunction(func);
          if (functionObj) {
            result.functions.push(functionObj);
          }
        }

        // Actions
        const actions = container.getElementsByTagName('Action');
        for (let n = 0; n < actions.length; n++) {
          const action = actions[n];
          const actionObj = this.parseAction(action);
          if (actionObj) {
            result.actions.push(actionObj);
          }
        }
      }
    }
  }

  private parseEntityType(entityTypeElement: Element, namespace: string): ODataEntity | null {
    const name = entityTypeElement.getAttribute('Name');
    if (!name) return null;

    const entity: ODataEntity = {
      name,
      namespace,
      properties: [],
      keyProperties: [],
      navigationProperties: [],
    };

    // Parse Key properties
    const keys = entityTypeElement.getElementsByTagName('PropertyRef');
    for (let i = 0; i < keys.length; i++) {
      const keyName = keys[i].getAttribute('Name');
      if (keyName) {
        entity.keyProperties.push(keyName);
      }
    }

    // Parse Properties
    const properties = entityTypeElement.getElementsByTagName('Property');
    for (let i = 0; i < properties.length; i++) {
      const prop = this.parseProperty(properties[i]);
      if (prop) {
        prop.isKey = entity.keyProperties.includes(prop.name);
        entity.properties.push(prop);
      }
    }

    // Parse NavigationProperties
    const navProps = entityTypeElement.getElementsByTagName('NavigationProperty');
    for (let i = 0; i < navProps.length; i++) {
      const navProp = this.parseNavigationProperty(navProps[i]);
      if (navProp) {
        entity.navigationProperties?.push(navProp);
      }
    }

    return entity;
  }

  private parseProperty(propertyElement: Element): ODataProperty | null {
    const name = propertyElement.getAttribute('Name');
    const type = propertyElement.getAttribute('Type');
    
    if (!name || !type) return null;

    const property: ODataProperty = {
      name,
      type,
      nullable: propertyElement.getAttribute('Nullable') !== 'false',
    };

    const maxLength = propertyElement.getAttribute('MaxLength');
    if (maxLength && maxLength !== 'Max') {
      property.maxLength = parseInt(maxLength, 10);
    }

    const precision = propertyElement.getAttribute('Precision');
    if (precision) {
      property.precision = parseInt(precision, 10);
    }

    const scale = propertyElement.getAttribute('Scale');
    if (scale) {
      property.scale = parseInt(scale, 10);
    }

    const defaultValue = propertyElement.getAttribute('DefaultValue');
    if (defaultValue) {
      property.defaultValue = this.parseDefaultValue(defaultValue, type);
    }

    return property;
  }

  private parseNavigationProperty(navPropElement: Element): ODataNavigationProperty | null {
    const name = navPropElement.getAttribute('Name');
    const relationship = navPropElement.getAttribute('Relationship');
    const fromRole = navPropElement.getAttribute('FromRole');
    const toRole = navPropElement.getAttribute('ToRole');

    if (!name || !relationship || !fromRole || !toRole) return null;

    return {
      name,
      relationship,
      fromRole,
      toRole,
      multiplicity: navPropElement.getAttribute('Multiplicity') || undefined,
    };
  }

  private parseEntitySet(entitySetElement: Element): ODataEntitySet | null {
    const name = entitySetElement.getAttribute('Name');
    const entityType = entitySetElement.getAttribute('EntityType');

    if (!name || !entityType) return null;

    const entitySet: ODataEntitySet = {
      name,
      entityType: entityType.split('.').pop() || entityType, // Remove namespace
      creatable: true, // Default assumptions
      updatable: true,
      deletable: true,
      searchable: true,
      countable: true,
    };

    // Check SAP annotations for capabilities
    const sapCreatable = entitySetElement.getAttribute('sap:creatable');
    const sapUpdatable = entitySetElement.getAttribute('sap:updatable');
    const sapDeletable = entitySetElement.getAttribute('sap:deletable');
    const sapSearchable = entitySetElement.getAttribute('sap:searchable');

    if (sapCreatable === 'false') entitySet.creatable = false;
    if (sapUpdatable === 'false') entitySet.updatable = false;
    if (sapDeletable === 'false') entitySet.deletable = false;
    if (sapSearchable === 'false') entitySet.searchable = false;

    return entitySet;
  }

  private parseFunctionImport(functionImportElement: Element): ODataFunction | null {
    const name = functionImportElement.getAttribute('Name');
    if (!name) return null;

    const func: ODataFunction = {
      name,
      parameters: [],
      returnType: functionImportElement.getAttribute('ReturnType') || undefined,
      httpMethod: functionImportElement.getAttribute('m:HttpMethod') || 'GET',
    };

    // Parse Parameters
    const parameters = functionImportElement.getElementsByTagName('Parameter');
    for (let i = 0; i < parameters.length; i++) {
      const param = this.parseParameter(parameters[i]);
      if (param) {
        func.parameters.push(param);
      }
    }

    return func;
  }

  private parseFunction(functionElement: Element): ODataFunction | null {
    const name = functionElement.getAttribute('Name');
    if (!name) return null;

    const func: ODataFunction = {
      name,
      parameters: [],
      returnType: functionElement.getAttribute('ReturnType') || undefined,
      httpMethod: 'GET',
    };

    // Parse Parameters
    const parameters = functionElement.getElementsByTagName('Parameter');
    for (let i = 0; i < parameters.length; i++) {
      const param = this.parseParameter(parameters[i]);
      if (param) {
        func.parameters.push(param);
      }
    }

    return func;
  }

  private parseAction(actionElement: Element): ODataAction | null {
    const name = actionElement.getAttribute('Name');
    if (!name) return null;

    const action: ODataAction = {
      name,
      parameters: [],
      returnType: actionElement.getAttribute('ReturnType') || undefined,
    };

    // Parse Parameters
    const parameters = actionElement.getElementsByTagName('Parameter');
    for (let i = 0; i < parameters.length; i++) {
      const param = this.parseParameter(parameters[i]);
      if (param) {
        action.parameters.push(param);
      }
    }

    return action;
  }

  private parseParameter(parameterElement: Element): ODataParameter | null {
    const name = parameterElement.getAttribute('Name');
    const type = parameterElement.getAttribute('Type');

    if (!name || !type) return null;

    return {
      name,
      type,
      nullable: parameterElement.getAttribute('Nullable') !== 'false',
      mode: (parameterElement.getAttribute('Mode') as 'In' | 'Out' | 'InOut') || 'In',
    };
  }

  private parseDefaultValue(value: string, type: string): any {
    switch (type) {
      case 'Edm.Boolean':
        return value.toLowerCase() === 'true';
      case 'Edm.Int16':
      case 'Edm.Int32':
      case 'Edm.Int64':
      case 'Edm.Byte':
      case 'Edm.SByte':
        return parseInt(value, 10);
      case 'Edm.Single':
      case 'Edm.Double':
      case 'Edm.Decimal':
        return parseFloat(value);
      default:
        return value;
    }
  }

  isODataV4(metadata: ODataServiceMetadata): boolean {
    return metadata.version?.startsWith('4.') || false;
  }

  isODataV2(metadata: ODataServiceMetadata): boolean {
    return metadata.version?.startsWith('2.') || metadata.version?.startsWith('3.') || false;
  }
}