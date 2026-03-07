import * as fs from 'fs';
import * as path from 'path';

describe('generate-json-schemas script', () => {
  const schemaDir = path.join(
    __dirname,
    '../../src/engine/metadata-modules/json-schemas',
  );

  it('should have generated the expected schema files', () => {
    // This test ensures the `yarn generate:schemas` output exists.
    // In a real CI environment, `yarn generate:schemas` would be run before tests,
    // or this test would test the extracted logic.
    // For now, checking if files exist and are valid JSON.
    const expectedSchemas = [
      'CreateObjectInput.json',
      'CreateFieldInput.json',
      'CreateViewInput.json',
      'CreateWebhookInput.json',
    ];

    for (const file of expectedSchemas) {
      const filePath = path.join(schemaDir, file);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('$schema');
      expect(parsed).toHaveProperty('properties');
    }
  });

  it('should not contain empty property definitions for audited fields', () => {
    const createObjectSchemaPath = path.join(schemaDir, 'CreateObjectInput.json');
    const createObjectSchema = JSON.parse(fs.readFileSync(createObjectSchemaPath, 'utf-8'));

    expect(createObjectSchema.properties.primaryKeyColumnType).toEqual(expect.objectContaining({ type: 'string' }));
    expect(createObjectSchema.properties.primaryKeyFieldMetadataSettings).toEqual(expect.objectContaining({ type: 'object' }));

    const createFieldSchemaPath = path.join(schemaDir, 'CreateFieldInput.json');
    const createFieldSchema = JSON.parse(fs.readFileSync(createFieldSchemaPath, 'utf-8'));

    expect(createFieldSchema.properties.isRemoteCreation).toEqual(expect.objectContaining({ type: 'boolean' }));
    expect(createFieldSchema.properties.relationCreationPayload).toEqual(expect.objectContaining({ type: 'object' }));
    expect(createFieldSchema.properties.morphRelationsCreationPayload).toEqual(expect.objectContaining({ type: 'array' }));
  });
});
