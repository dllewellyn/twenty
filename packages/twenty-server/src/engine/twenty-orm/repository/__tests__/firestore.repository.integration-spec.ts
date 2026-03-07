import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import * as admin from 'firebase-admin';
import { FirestoreRepository } from '../firestore.repository';
import * as fs from 'fs';
import * as path from 'path';

// Load a real schema to test with
const schemaPath = path.join(__dirname, '../../../metadata-modules/json-schemas/CreateFieldInput.json');
const rawSchema = fs.readFileSync(schemaPath, 'utf8');
const createFieldSchema = JSON.parse(rawSchema);

describe('FirestoreRepository Integration', () => {
  let db: admin.firestore.Firestore;
  let repository: FirestoreRepository<any>;
  let createdDocId: string;

  beforeAll(async () => {
    // Disable fake timers for this specific test suite as gRPC requires real timers to function
    jest.useRealTimers();

    // Initialize the firebase-admin SDK if it hasn't been initialized yet
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'demo-twenty',
      });
    }

    db = admin.firestore();
    db.settings({
      host: '127.0.0.1:8080',
      ssl: false,
    });

    repository = new FirestoreRepository('test_fields', createFieldSchema);
  });

  afterAll(async () => {
    // Clean up the test document
    if (createdDocId) {
      await repository.delete(createdDocId);
    }
    // Delete the default app to prevent issues with other tests that might use firebase-admin
    if (admin.apps.length > 0 && admin.app()) {
      await admin.app().delete();
    }

    // Restore fake timers to not affect other tests
    jest.useFakeTimers();
  });

  it('should initialize successfully with a valid schema', () => {
    expect(repository).toBeDefined();
  });

  it('should throw validation error on create with invalid data', async () => {
    const invalidData = {
      // Missing required fields if any, or wrong types
      objectMetadataId: 'not-a-uuid', // wrong format
      universalIdentifier: 123, // wrong type
    };

    await expect(repository.create(invalidData)).rejects.toThrow(/Validation failed/);
  });

  it('should successfully create, read, update, and delete a document', async () => {
    // Using valid data for CreateFieldInput
    // Let's create a simplified valid object based on typical properties
    // We can also just use a basic custom schema if needed, but the requirements say to use existing schemas.
    // Let's construct a valid payload.
    const validData = {
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'my_custom_field',
      name: 'my_custom_field',
      label: 'My Custom Field',
      type: 'TEXT',
      isActive: true,
      isSystem: false,
      isCustom: true,
    };

    // 1. Create
    const docRef = await repository.create(validData);
    expect(docRef).toBeDefined();
    expect(docRef.id).toBeDefined();
    createdDocId = docRef.id;

    // 2. Read (findOne)
    const fetchedDoc = await repository.findOne(createdDocId);
    expect(fetchedDoc).toBeDefined();
    expect(fetchedDoc?.universalIdentifier).toBe(validData.universalIdentifier);

    // 3. Update
    const updateData = { label: 'Updated Field Label' };
    await repository.update(createdDocId, updateData);

    const updatedDoc = await repository.findOne(createdDocId);
    expect(updatedDoc?.label).toBe('Updated Field Label');

    // 4. Read (find)
    const allDocs = await repository.find();
    expect(allDocs.length).toBeGreaterThan(0);
    expect(allDocs.some(doc => doc.universalIdentifier === validData.universalIdentifier)).toBe(true);

    // 5. Delete
    await repository.delete(createdDocId);
    const deletedDoc = await repository.findOne(createdDocId);
    expect(deletedDoc).toBeNull();

    // Prevent afterAll from trying to delete it again
    createdDocId = '';
  });

  it('should throw partial validation error on update with invalid partial data', async () => {
    // Create a doc first
    const validData = {
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'another_field',
      name: 'another_field',
      label: 'Another Field',
      type: 'TEXT',
    };
    const docRef = await repository.create(validData);
    const id = docRef.id;

    const invalidUpdateData = {
      label: 12345 // Should be string
    };

    await expect(repository.update(id, invalidUpdateData)).rejects.toThrow(/Partial validation failed/);

    await repository.delete(id);
  });
});
