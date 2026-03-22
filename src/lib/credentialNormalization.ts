/**
 * Credential Data Normalization Utility
 *
 * n8n uses JSON Schema with allOf/oneOf for conditional validation.
 * This utility ensures credential data satisfies these requirements by:
 * 1. Setting schema-defined defaults
 * 2. Setting safe defaults for boolean "trigger" fields
 *
 * Used by:
 * - API key credentials (POST /api/client/credentials)
 * - OAuth credentials (buildOAuth2CredentialData)
 * - All 600+ n8n credential types
 */

/**
 * Normalize credential data based on schema to satisfy conditional requirements
 *
 * Examples of affected credentials:
 * - anthropicApi: header → headerName, headerValue
 * - openAiApi: useCustomUrl → baseURL
 * - googleSheetsOAuth2Api: useCustomApiEndpoint → customApiEndpoint
 * - httpBasicAuth: allowUnauthorizedCerts → SSL options
 * - stripeApi: customApiUrl → apiUrl
 */
export function normalizeCredentialData(
  data: Record<string, any>,
  schema?: any
): Record<string, any> {
  const normalized = { ...data };

  if (!schema?.properties) {
    return normalized;
  }

  // Build set of required fields for quick lookup
  const requiredFields = new Set(schema.required || []);

  // Step 1: Process all schema properties
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as any;

    // Skip fields already provided by user
    if (propName in normalized) continue;

    // Skip fields that are explicitly required (user must provide these)
    // We only set defaults for OPTIONAL fields
    if (requiredFields.has(propName)) continue;

    // Step 2: Apply explicit default from schema
    if (prop.default !== undefined) {
      normalized[propName] = prop.default;
      continue;
    }

    // Step 3: Extract enum from allOf/oneOf if not directly on property
    let enumValues = prop.enum;

    // Helper to recursively extract enum values from nested schemas
    const extractEnumFromSchemas = (schemas: any[]): string[] | null => {
      for (const subSchema of schemas) {
        // Direct enum array
        if (subSchema.enum && Array.isArray(subSchema.enum)) {
          return subSchema.enum;
        }

        // const values (collect into array)
        if (subSchema.const !== undefined) {
          return [subSchema.const];
        }

        // Nested allOf/oneOf
        if (subSchema.allOf && Array.isArray(subSchema.allOf)) {
          const nested = extractEnumFromSchemas(subSchema.allOf);
          if (nested) return nested;
        }
        if (subSchema.oneOf && Array.isArray(subSchema.oneOf)) {
          const nested = extractEnumFromSchemas(subSchema.oneOf);
          if (nested) return nested;
        }
      }
      return null;
    };

    if (!enumValues && (prop.allOf || prop.oneOf)) {
      const schemas = prop.allOf || prop.oneOf;
      enumValues = extractEnumFromSchemas(schemas);
    }

    // For oneOf with const values, collect all const values
    if (!enumValues && prop.oneOf && Array.isArray(prop.oneOf)) {
      const constValues = prop.oneOf
        .filter((s: any) => s.const !== undefined)
        .map((s: any) => s.const);
      if (constValues.length > 0) {
        enumValues = constValues;
      }
    }

    // Step 4: Set type-based safe defaults for optional fields
    // This handles conditional requirements automatically without hardcoding field names

    // Boolean fields → false (disables conditional requirements)
    if (prop.type === 'boolean') {
      normalized[propName] = false;
    }

    // String fields with enum → use first enum value
    // Schema authors typically put the default/safest value first
    else if (prop.type === 'string' && enumValues && Array.isArray(enumValues) && enumValues.length > 0) {
      normalized[propName] = enumValues[0];
    }

    // String fields → empty string (satisfies allOf validation for optional strings)
    else if (prop.type === 'string') {
      normalized[propName] = '';
    }

    // Object fields → empty object (satisfies allOf validation for optional objects)
    else if (prop.type === 'object') {
      normalized[propName] = {};
    }

    // Array fields → empty array (satisfies allOf validation for optional arrays)
    else if (prop.type === 'array') {
      normalized[propName] = [];
    }

    // Number/integer fields → 0 (safe default for optional numbers)
    else if (prop.type === 'number' || prop.type === 'integer') {
      normalized[propName] = 0;
    }
  }

  return normalized;
}

/**
 * Log what fields were added during normalization (for debugging)
 */
export function logNormalization(
  originalData: Record<string, any>,
  normalizedData: Record<string, any>,
  credentialType: string
): void {
  const addedFields = Object.keys(normalizedData).filter(k => !(k in originalData));

  if (addedFields.length > 0) {
    console.log(`[credentials/normalize] ${credentialType}: Added defaults for:`,
      addedFields.map(k => `${k}=${JSON.stringify(normalizedData[k])}`).join(', ')
    );
  }
}
