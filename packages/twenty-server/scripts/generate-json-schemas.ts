import * as fs from 'fs';
import * as path from 'path';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
const { defaultMetadataStorage } = require('class-transformer/cjs/storage');

// Import the DTO classes so their metadata is loaded
import { CreateObjectInput } from '../src/engine/metadata-modules/object-metadata/dtos/create-object.input';
import { CreateFieldInput } from '../src/engine/metadata-modules/field-metadata/dtos/create-field.input';
import { CreateViewInput } from '../src/engine/metadata-modules/view/dtos/inputs/create-view.input';
import { CreateWebhookInput } from '../src/engine/metadata-modules/webhook/dtos/create-webhook.input';

async function generateSchemas() {
  console.log('Generating JSON schemas from class-validator metadata...');

  // Target DTOs we want to extract schemas for
  const targets = {
    CreateObjectInput,
    CreateFieldInput,
    CreateViewInput,
    CreateWebhookInput,
  };

  const schemas = validationMetadatasToSchemas({
    classTransformerMetadataStorage: defaultMetadataStorage,
    refPointerPrefix: '#/definitions/',
  });

  const outputDir = path.join(
    __dirname,
    '../src/engine/metadata-modules/json-schemas',
  );

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [name, targetClass] of Object.entries(targets)) {
    // The schema name might not exactly match the class name depending on class-validator-jsonschema
    // It typically matches the class name if decorated properly, but we can search for it
    const schemaName = targetClass.name;
    const schema = schemas[schemaName];

    if (schema) {
      // Add definitions if they exist in the root schemas object
      const fullSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        ...schema,
        definitions: schemas, // Include all definitions just in case there are references
      };

      const outputPath = path.join(outputDir, `${schemaName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(fullSchema, null, 2));
      console.log(`Generated schema for ${schemaName} at ${outputPath}`);
    } else {
      console.warn(`No schema found for ${schemaName}`);
    }
  }

  console.log('Schema generation complete.');
}

generateSchemas().catch((err) => {
  console.error('Error generating schemas:', err);
  process.exit(1);
});
