import { connectionSource } from '../src/database/typeorm/core/core.datasource';
import { ObjectMetadataEntity } from '../src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { FieldMetadataEntity } from '../src/engine/metadata-modules/field-metadata/field-metadata.entity';
import * as admin from 'firebase-admin';

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

  console.log('Connecting to PostgreSQL database...');

  connectionSource.setOptions({
    entities: [
      __dirname + '/../src/engine/core-modules/**/*.entity{.ts,.js}',
      __dirname + '/../src/engine/metadata-modules/**/*.entity{.ts,.js}',
    ]
  });

  await connectionSource.initialize();

  const objectRepo = connectionSource.getRepository(ObjectMetadataEntity);

  console.log('Fetching objects and fields from Postgres...');
  const objects = await objectRepo.find({
    relations: {
      fields: true,
    },
  });

  console.log(`Found ${objects.length} objects in Postgres.`);

  console.log('Fetching metadata documents from Firestore...');
  const firestoreDocsSnapshot = await db.collection('_metadata').get();
  const firestoreDocs = firestoreDocsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

  console.log(`Found ${firestoreDocs.length} documents in Firestore.`);

  let successCount = 0;
  let missingObjectsCount = 0;
  let propertyMismatchesCount = 0;
  let schemaErrorsCount = 0;
  let orphanCount = 0;

  const postgresIds = new Set<string>();

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
    const docId = `${workspaceId}_${nameSingular}`;
    postgresIds.add(docId);

    const firestoreDoc = firestoreDocs.find(doc => doc.id === docId);

    if (!firestoreDoc) {
      console.error(`[Missing Object] Postgres object ${docId} not found in Firestore.`);
      missingObjectsCount++;
      continue;
    }

    const fsData = firestoreDoc.data;

    let hasPropertyMismatch = false;
    const checkProperty = (propName: string, pgValue: unknown, fsValue: unknown) => {
      // Handle null/undefined equivalence
      if ((pgValue === null || pgValue === undefined) && (fsValue === null || fsValue === undefined)) {
        return;
      }
      if (pgValue !== fsValue) {
        console.error(`[Property Mismatch] ${docId} - ${propName}: Postgres='${pgValue}', Firestore='${fsValue}'`);
        hasPropertyMismatch = true;
      }
    };

    checkProperty('nameSingular', nameSingular, fsData.nameSingular);
    checkProperty('namePlural', namePlural, fsData.namePlural);
    checkProperty('labelSingular', labelSingular, fsData.labelSingular);
    checkProperty('labelPlural', labelPlural, fsData.labelPlural);
    checkProperty('icon', icon, fsData.icon);
    checkProperty('description', description, fsData.description);
    checkProperty('workspaceId', workspaceId, fsData.workspaceId);

    if (hasPropertyMismatch) {
      propertyMismatchesCount++;
    }

    let hasSchemaError = false;
    const jsonSchema = fsData.jsonSchema;

    if (!jsonSchema) {
        console.error(`[Schema Error] ${docId} - Missing jsonSchema in Firestore.`);
        hasSchemaError = true;
    } else {
        const properties = jsonSchema.properties || {};
        const required = jsonSchema.required || [];

        if (fields) {
          for (const field of fields) {
            if (!field.isActive) continue;

            if (!(field.name in properties)) {
              console.error(`[Schema Error] ${docId} - Active field '${field.name}' is missing from jsonSchema.properties.`);
              hasSchemaError = true;
            }

            if (field.isNullable === false) {
              if (!required.includes(field.name)) {
                console.error(`[Schema Error] ${docId} - Field '${field.name}' is isNullable: false in Postgres but not in jsonSchema.required.`);
                hasSchemaError = true;
              }
            } else if (field.isNullable === true) {
              if (required.includes(field.name)) {
                console.error(`[Schema Error] ${docId} - Field '${field.name}' is isNullable: true in Postgres but is in jsonSchema.required.`);
                hasSchemaError = true;
              }
            }
          }
        }
    }

    if (hasSchemaError) {
      schemaErrorsCount++;
    }

    if (!hasPropertyMismatch && !hasSchemaError) {
      successCount++;
    }
  }

  for (const doc of firestoreDocs) {
    if (!postgresIds.has(doc.id)) {
      console.error(`[Orphan Document] Firestore document ${doc.id} does not have a corresponding record in Postgres.`);
      orphanCount++;
    }
  }

  console.log('\n--- Verification Summary ---');
  console.log(`Total Objects Checked: ${objects.length}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Missing Objects: ${missingObjectsCount}`);
  console.log(`Property Mismatches: ${propertyMismatchesCount}`);
  console.log(`Schema Errors: ${schemaErrorsCount}`);
  console.log(`Orphan Documents: ${orphanCount}`);

  await connectionSource.destroy();
}

if (require.main === module) {
  main().catch(console.error);
}
