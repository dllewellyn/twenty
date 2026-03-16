import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import * as admin from 'firebase-admin';
import { BaseFirestoreRepository } from '../firestore.repository';
import { MetadataService } from '../../../metadata-modules/metadata.service';
import * as fs from 'fs';
import * as path from 'path';

// Load a real schema to test with
const schemaPath = path.join(
  __dirname,
  '../../../metadata-modules/json-schemas/CreateFieldInput.json',
);
const rawSchema = fs.readFileSync(schemaPath, 'utf8');
const createFieldSchema = JSON.parse(rawSchema);

describe('BaseFirestoreRepository Integration', () => {
  let db: admin.firestore.Firestore;
  let repository: BaseFirestoreRepository<any>;
  let createdDocId: string;
  let mockMetadataService: MetadataService;

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

    // We can instantiate MetadataService normally or create a complete mock.
    // Here we use the real service with the firebaseApp but update its cache manually to avoid needing `_metadata` setup in emulator
    mockMetadataService = new MetadataService(admin.app());
    mockMetadataService.updateCache(
      'test_workspace',
      'test_fields',
      createFieldSchema,
    );

    // We override getValidator to ensure it only reads from cache so we don't need real Firestore calls for `_metadata`
    jest
      .spyOn(mockMetadataService, 'getValidator')
      .mockImplementation(async (objectName: string, workspaceId: string) => {
        // Since updateCache was called above, the cache has this populated
        // We can directly call the real method or replicate cache checking logic.
        // We'll just return from the internal cache property or we can let the real method throw if missing
        const cache = (mockMetadataService as any).validatorsCache.get(
          workspaceId,
        );
        if (cache && cache.has(objectName)) {
          return cache.get(objectName);
        }
        throw new Error(`Validator not found`);
      });

    repository = new BaseFirestoreRepository(
      'test_fields',
      mockMetadataService,
      'test_workspace',
      admin.app(),
    );
  });

  afterAll(async () => {
    // Clean up the test document
    if (createdDocId) {
      await repository.delete(createdDocId);
    }
    mockMetadataService.onModuleDestroy();

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

    await expect(repository.create(invalidData)).rejects.toThrow(
      /Validation failed/,
    );
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
    expect(
      allDocs.some(
        (doc) => doc.universalIdentifier === validData.universalIdentifier,
      ),
    ).toBe(true);

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
      label: 12345, // Should be string
    };

    await expect(repository.update(id, invalidUpdateData)).rejects.toThrow(
      /Partial validation failed/,
    );

    await repository.delete(id);
  });

  it('should implement count', async () => {
    // Clear out
    const initialCount = await repository.count();

    // Add two
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'count_field_1',
      name: 'count_field_1',
      label: 'Count Field 1',
      type: 'TEXT',
    });
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'count_field_2',
      name: 'count_field_2',
      label: 'Count Field 2',
      type: 'TEXT',
    });

    const newCount = await repository.count();
    expect(newCount).toBe(initialCount + 2);

    const countWithFilters = await repository.count({
      where: { name: 'count_field_1' },
    });
    expect(countWithFilters).toBe(1);
  });

  it('should implement save for multiple documents', async () => {
    const docsToSave = [
      {
        objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
        universalIdentifier: 'save_field_1',
        name: 'save_field_1',
        label: 'Save Field 1',
        type: 'TEXT',
      },
      {
        objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
        universalIdentifier: 'save_field_2',
        name: 'save_field_2',
        label: 'Save Field 2',
        type: 'TEXT',
      },
    ];

    await repository.save(docsToSave);

    const found = await repository.find({ where: { name: 'save_field_1' } });
    expect(found.length).toBe(1);
    expect(found[0].label).toBe('Save Field 1');
  });

  it('should support find with basic filters', async () => {
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'find_filter_1',
      name: 'find_filter_1',
      label: 'Find Filter 1',
      type: 'TEXT',
      isActive: true,
    });

    const results = await repository.find({ where: { name: 'find_filter_1' } });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('find_filter_1');
    expect(results[0].isActive).toBe(true);

    // Testing take / limit
    const allFinds = await repository.find({ take: 1 });
    expect(allFinds.length).toBe(1);
  });

  it('should support deep filtering', async () => {
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'deep_filter_1',
      name: 'deep_filter_1',
      label: 'Deep Filter 1',
      type: 'TEXT',
      settings: {
        nestedSetting: 'active',
      },
    });

    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'deep_filter_2',
      name: 'deep_filter_2',
      label: 'Deep Filter 2',
      type: 'TEXT',
      settings: {
        nestedSetting: 'inactive',
      },
    });

    const results = await repository.find({
      where: {
        settings: {
          nestedSetting: 'active',
        },
      },
    });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('deep_filter_1');
  });

  it('should implement findAndCount', async () => {
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'find_and_count_1',
      name: 'find_and_count_1',
      label: 'Find And Count 1',
      type: 'TEXT',
      isActive: true,
    });
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'find_and_count_2',
      name: 'find_and_count_2',
      label: 'Find And Count 2',
      type: 'TEXT',
      isActive: true,
    });

    const [results, count] = await repository.findAndCount({
      where: { name: { _type: 'in', _value: ['find_and_count_1', 'find_and_count_2'] } },
      take: 1,
    });

    expect(results.length).toBe(1);
    expect(count).toBe(2);
  });

  it('should support prefix matching via startsWith', async () => {
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'startsWith_Apple',
      name: 'Apple',
      label: 'Apple Label',
      type: 'TEXT',
      isActive: true,
    });
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'startsWith_Appricot',
      name: 'Appricot',
      label: 'Appricot Label',
      type: 'TEXT',
      isActive: true,
    });
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'startsWith_Banana',
      name: 'Banana',
      label: 'Banana Label',
      type: 'TEXT',
      isActive: true,
    });

    const results = await repository.find({
      where: { name: { _type: 'startsWith', _value: 'App' } },
    });

    expect(results.length).toBe(2);
    expect(results.map((r: any) => r.name).sort()).toEqual(['Apple', 'Appricot']);
  });

  it('should handle Date filters correctly', async () => {
    // First, let's create actual documents with a Date property.
    // Assuming the current schema allows additional properties, or we can use partial `update` if it bypasses some checks.
    // In BaseFirestoreRepository, partialValidator might still complain, but let's try just bypassing schema check for test, or we can see if it allows the field.
    // The test schema `CreateFieldInput.json` probably doesn't have `dummyDate`. But Firestore itself doesn't care if Ajv isn't blocking it.
    // Wait, the repository.create calls validator(data). Let's use `createdAt` which is sometimes a standard property, or just mock the validator for this test to allow everything.

    // Instead of messing with schemas, we can write directly via the db instance just to test `find` logic
    const db = admin.firestore();
    const collectionRef = db.collection('test_fields');

    const pastDate = new Date('2020-01-01T00:00:00.000Z');
    const futureDate = new Date('2030-01-01T00:00:00.000Z');

    const doc1Ref = collectionRef.doc();
    await doc1Ref.set({
      name: 'date_doc_1',
      myCustomDate: pastDate,
      objectMetadataId: '123',
      universalIdentifier: 'date_doc_1',
      type: 'TEXT'
    });

    const doc2Ref = collectionRef.doc();
    await doc2Ref.set({
      name: 'date_doc_2',
      myCustomDate: futureDate,
      objectMetadataId: '123',
      universalIdentifier: 'date_doc_2',
      type: 'TEXT'
    });

    // Now test finding with equality
    const exactResults = await repository.find({ where: { myCustomDate: pastDate } });
    expect(exactResults.length).toBe(1);
    expect(exactResults[0].name).toBe('date_doc_1');

    // Test finding with moreThan
    const intermediateDate = new Date('2025-01-01T00:00:00.000Z');
    const moreThanResults = await repository.find({ where: { myCustomDate: { _type: 'moreThan', _value: intermediateDate } } });
    expect(moreThanResults.length).toBe(1);
    expect(moreThanResults[0].name).toBe('date_doc_2');

    // Test finding with lessThan
    const lessThanResults = await repository.find({ where: { myCustomDate: { _type: 'lessThan', _value: intermediateDate } } });
    expect(lessThanResults.length).toBe(1);
    expect(lessThanResults[0].name).toBe('date_doc_1');

    // Cleanup
    await doc1Ref.delete();
    await doc2Ref.delete();
  });

  it('should support advanced operators', async () => {
    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'advanced_op_1',
      name: 'advanced_op_1',
      label: 'Advanced Op 1',
      type: 'TEXT',
      order: 10,
      tags: ['tagA', 'tagB'],
    });

    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'advanced_op_2',
      name: 'advanced_op_2',
      label: 'Advanced Op 2',
      type: 'TEXT',
      order: 20,
      tags: ['tagB', 'tagC'],
    });

    await repository.create({
      objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
      universalIdentifier: 'advanced_op_3',
      name: 'advanced_op_3',
      label: 'Advanced Op 3',
      type: 'TEXT',
      order: 30,
      tags: ['tagD'],
    });

    // Test 'not' operator
    const notResults = await repository.find({
      where: { name: { _type: 'not', _value: 'advanced_op_1' } },
    });
    // Assuming other tests might have created other docs, so we check if advanced_op_1 is not included, and 2/3 are included
    expect(notResults.find((d) => d.name === 'advanced_op_1')).toBeUndefined();
    expect(notResults.find((d) => d.name === 'advanced_op_2')).toBeDefined();

    // Test 'between' operator
    const betweenResults = await repository.find({
      where: { order: { _type: 'between', _value: [15, 25] } },
    });
    expect(betweenResults.length).toBe(1);
    expect(betweenResults[0].name).toBe('advanced_op_2');

    // Test 'arrayContains'
    const containsResults = await repository.find({
      where: { tags: { _type: 'arrayContains', _value: 'tagB' } },
    });
    // order 10 and 20 both have tagB
    expect(containsResults.length).toBe(2);
    expect(containsResults.map((d) => d.name).sort()).toEqual([
      'advanced_op_1',
      'advanced_op_2',
    ]);
  });

  it('should support orderBy, limits, and cursor-based pagination', async () => {
    // Clear the collection to make pagination predictable, or use a specific prefix
    await repository.create({
      objectMetadataId: '123',
      universalIdentifier: 'page_1',
      name: 'page_1',
      type: 'TEXT',
      order: 1,
    });
    await repository.create({
      objectMetadataId: '123',
      universalIdentifier: 'page_2',
      name: 'page_2',
      type: 'TEXT',
      order: 2,
    });
    await repository.create({
      objectMetadataId: '123',
      universalIdentifier: 'page_3',
      name: 'page_3',
      type: 'TEXT',
      order: 3,
    });

    // Order by descending
    const orderedResults = await repository.find({
      where: { name: { _type: 'in', _value: ['page_1', 'page_2', 'page_3'] } },
      order: { order: 'DESC' },
    });
    expect(orderedResults.length).toBe(3);
    expect(orderedResults[0].name).toBe('page_3');
    expect(orderedResults[1].name).toBe('page_2');
    expect(orderedResults[2].name).toBe('page_1');

    // Limit and order
    const limitedResults = await repository.find({
      where: { name: { _type: 'in', _value: ['page_1', 'page_2', 'page_3'] } },
      order: { order: 'ASC' },
      take: 2,
    });
    expect(limitedResults.length).toBe(2);
    expect(limitedResults[0].name).toBe('page_1');
    expect(limitedResults[1].name).toBe('page_2');

    // Wait for the previous docs to settle in emulator or just fetch the doc snapshot
    const db = admin.firestore();
    const snapshot = await db
      .collection('test_fields')
      .where('name', '==', 'page_2')
      .get();
    const cursorDoc = snapshot.docs[0];

    // Cursor pagination using startAfter
    const paginatedResults = await repository.find({
      where: { name: { _type: 'in', _value: ['page_1', 'page_2', 'page_3'] } },
      order: { order: 'ASC' },
      cursor: cursorDoc,
    });
    expect(paginatedResults.length).toBe(1);
    expect(paginatedResults[0].name).toBe('page_3');
  });

  it('should implement upsert', async () => {
    // Requires an ID usually, let's create one manually.
    const customId = 'custom-upsert-id-123';
    await repository.upsert(
      {
        id: customId,
        objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
        universalIdentifier: 'upsert_field_1',
        name: 'upsert_field_1',
        label: 'Upsert Field 1',
        type: 'TEXT',
      },
      ['id'],
    );

    let fetched = await repository.findOne(customId);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('upsert_field_1');

    // Update it
    await repository.upsert(
      {
        id: customId,
        label: 'Updated Upsert Field 1',
      },
      ['id'],
    );

    fetched = await repository.findOne(customId);
    expect(fetched?.label).toBe('Updated Upsert Field 1');
  });
});
