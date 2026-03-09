import { connectionSource } from '../src/database/typeorm/core/core.datasource';
import { ObjectMetadataEntity } from '../src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { FieldMetadataEntity } from '../src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataType } from 'twenty-shared/types';
import * as admin from 'firebase-admin';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.warn('FIRESTORE_EMULATOR_HOST is not set. Connecting to production Firestore?');
  }

  // Initialize Firebase Admin
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'twenty-local',
    });
  }

  const db = admin.firestore();

  // Initialize AJV
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  console.log('Connecting to PostgreSQL database...');

  // We need to pass the correct entities to the datasource because when run outside of jest or build,
  // it doesn't load entities correctly because the path resolves to 'dist/' which doesn't exist for the script context
  connectionSource.setOptions({
    entities: [
      __dirname + '/../src/engine/core-modules/**/*.entity{.ts,.js}',
      __dirname + '/../src/engine/metadata-modules/**/*.entity{.ts,.js}',
    ]
  });

  await connectionSource.initialize();

  const objectRepo = connectionSource.getRepository(ObjectMetadataEntity);
  const fieldRepo = connectionSource.getRepository(FieldMetadataEntity);

  console.log('Fetching objects and fields...');
  const objects = await objectRepo.find({
    relations: {
      fields: true,
    },
  });

  console.log(`Found ${objects.length} objects.`);

  let successCount = 0;
  let errorCount = 0;

  for (const obj of objects) {
    const {
      nameSingular,
      namePlural,
      labelSingular,
      labelPlural,
      icon,
      description,
      fields,
      isSystem,
    } = obj;

    const workspaceId = isSystem ? 'system' : obj.workspaceId;

    const schemaId = `https://twenty.com/schemas/v1/metadata/${workspaceId}/${nameSingular}`;

    const jsonSchema: Record<string, unknown> & {
      $id: string;
      properties: Record<string, unknown>;
      required: string[];
    } = {
      $id: schemaId,
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: true,
    };

    if (fields) {
      for (const field of fields) {
        if (!field.isActive) continue; // Should we ignore inactive?
        let propertyType: Record<string, unknown> = {};

        switch (field.type) {
          case FieldMetadataType.TEXT:
          case FieldMetadataType.RICH_TEXT:
          case FieldMetadataType.RICH_TEXT_V2:
            propertyType = { type: 'string' };
            break;
          case FieldMetadataType.SELECT:
            propertyType = { type: 'string' };
            const selectOptions = (field.options as any)?.options?.map((opt: any) => opt.value);
            if (selectOptions && selectOptions.length > 0) {
              propertyType.enum = selectOptions;
            }
            break;
          case FieldMetadataType.UUID:
            propertyType = { type: 'string', format: 'uuid' };
            break;
          case FieldMetadataType.NUMBER:
          case FieldMetadataType.NUMERIC:
          case FieldMetadataType.POSITION:
            propertyType = { type: 'number' };
            break;
          case FieldMetadataType.RATING:
            propertyType = { type: 'string' };
            break;
          case FieldMetadataType.CURRENCY:
            propertyType = { type: 'object' };
            break;
          case FieldMetadataType.BOOLEAN:
            propertyType = { type: 'boolean' };
            break;
          case FieldMetadataType.DATE:
            propertyType = { type: 'string', format: 'date' };
            break;
          case FieldMetadataType.DATE_TIME:
            propertyType = { type: 'string', format: 'date-time' };
            break;
          case FieldMetadataType.RAW_JSON:
          case FieldMetadataType.ADDRESS:
          case FieldMetadataType.FULL_NAME:
          case FieldMetadataType.ACTOR:
            propertyType = { type: 'object' };
            break;
          case FieldMetadataType.EMAILS:
          case FieldMetadataType.PHONES:
          case FieldMetadataType.LINKS:
          case FieldMetadataType.FILES:
            propertyType = { type: 'array', items: { type: 'object' } };
            break;
          case FieldMetadataType.MULTI_SELECT:
            propertyType = { type: 'array', items: { type: 'string' } };
            const multiSelectOptions = (field.options as any)?.options?.map((opt: any) => opt.value);
            if (multiSelectOptions && multiSelectOptions.length > 0) {
              (propertyType.items as Record<string, unknown>).enum = multiSelectOptions;
            }
            break;
          case FieldMetadataType.ARRAY:
            propertyType = { type: 'array' };
            break;
          case FieldMetadataType.RELATION:
          case FieldMetadataType.MORPH_RELATION:
            propertyType = { type: 'string', format: 'uuid' };
            break;
          default:
            propertyType = { type: 'string' };
        }

        // if nullable is false, make it required
        if (field.isNullable === false) {
          jsonSchema.required.push(field.name);
        }

        jsonSchema.properties[field.name] = propertyType;
      }
    }

    if (jsonSchema.required.length === 0) {
      delete jsonSchema.required;
    }

    // Verify schema compilation
    try {
      if (ajv.getSchema(schemaId)) {
        ajv.removeSchema(schemaId);
      }
      ajv.compile(jsonSchema);
    } catch (e) {
      console.error(`Error compiling schema for ${nameSingular} in workspace ${workspaceId}:`, e);
      errorCount++;
      continue;
    }

    const docId = `${workspaceId}_${nameSingular}`;

    const payload = {
      nameSingular,
      namePlural,
      labelSingular,
      labelPlural,
      icon,
      description,
      workspaceId,
      jsonSchema,
      isSystem,
    };

    try {
      await db.collection('_metadata').doc(docId).set(payload);
      successCount++;
    } catch (e) {
      console.error(`Error writing document ${docId} to Firestore:`, e);
      errorCount++;
    }
  }

  console.log(`Migration complete. Successfully migrated ${successCount} objects. Errors: ${errorCount}`);

  await connectionSource.destroy();
}

if (require.main === module) {
  main().catch(console.error);
}
