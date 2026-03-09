# Metadata Migration Strategy: Postgres to Firestore

## Context

As part of transitioning the `twenty-server` backend architecture from a PostgreSQL-based engine to a Firebase-native architecture, we need to migrate existing object and field metadata into a dynamic, JSON Schema-driven collection in Firestore named `_metadata`. This document outlines the migration design.

## Target Structure

The target is a single `_metadata` collection in Firestore.
Documents represent individual object types within a specific workspace (supporting multi-tenancy).

**Document Structure:**

```json
{
  "id": "uuid-string",
  "workspaceId": "workspace-uuid-string", // or "system" for core entities
  "nameSingular": "person",
  "namePlural": "people",
  "labelSingular": "Person",
  "labelPlural": "People",
  "isCustom": true,
  "jsonSchema": {
    "$id": "people-schema",
    "type": "object",
    "properties": {
      "id": { "type": "string", "format": "uuid" },
      "name": { "type": "string" }
      // ... mapped fields
    },
    "required": ["name"]
  },
  "uiMetadata": {
    "icon": "IconUser",
    "description": "A person object"
  }
}
```

## Migration Logic Sequence

1. **Read Entities from Postgres**

   - Query all records from the `ObjectMetadataEntity` table.
   - For each object, query its associated `FieldMetadataEntity` records.
   - Filter or separate system objects (`isSystem: true`) to assign them to `workspaceId: "system"`.

2. **Map Postgres Types to JSON Schema**

   - Iterate through `FieldMetadataEntity` records and map their types.
   - `UUID` -> `{ "type": "string", "format": "uuid" }`
   - `TEXT` / `VARCHAR` -> `{ "type": "string" }`
   - `NUMBER` -> `{ "type": "number" }`
   - `BOOLEAN` -> `{ "type": "boolean" }`
   - `RELATION` -> Map to nested objects or string references depending on how relations will be handled in Firestore (e.g., storing the related object's UUID).
   - Gather all non-nullable fields (`isNullable: false`) and add their names to the `required` array of the JSON schema.

3. **Handle Edge Cases and Legacy Data**

   - **Defensive Traversal**: Wrap field access in `try/catch` or use optional chaining to handle corrupted legacy records gracefully.
   - **AJV Formats**: Standard formats like `email`, `uuid`, and `date-time` should be mapped explicitly since the `MetadataService` enables `ajv-formats`.

4. **Transform to `_metadata` Format**

   - Construct the final JSON object matching the `_metadata` document structure for each mapped object.

5. **Seed the Firestore Collection**
   - Use `firebase-admin` batch writes to push the transformed documents to the `_metadata` collection.
   - For emulator testing, use a seed script connected to `FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"`.
