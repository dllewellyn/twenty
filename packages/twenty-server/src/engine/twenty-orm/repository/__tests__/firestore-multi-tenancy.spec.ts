import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import * as admin from 'firebase-admin';
import { BaseFirestoreRepository } from '../firestore.repository';
import { MetadataService } from '../../../metadata-modules/metadata.service';
import * as fs from 'fs';
import * as path from 'path';
import { withWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';

// Load a real schema to test with
const schemaPath = path.join(
  __dirname,
  '../../../metadata-modules/json-schemas/CreateFieldInput.json',
);
const rawSchema = fs.readFileSync(schemaPath, 'utf8');
const createFieldSchema = JSON.parse(rawSchema);

describe('BaseFirestoreRepository Multi-tenancy Integration', () => {
  let db: admin.firestore.Firestore;
  let repository: BaseFirestoreRepository<any>;
  let mockMetadataService: MetadataService;

  beforeAll(async () => {
    jest.useRealTimers();

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

    mockMetadataService = new MetadataService(admin.app());
    mockMetadataService.updateCache(
      'test_workspace',
      'test_fields',
      createFieldSchema,
    );
    mockMetadataService.updateCache(
        'other_workspace',
        'test_fields',
        createFieldSchema,
    );

    jest
      .spyOn(mockMetadataService, 'getValidator')
      .mockImplementation(async (objectName: string, workspaceId: string) => {
        const cache = (mockMetadataService as any).validatorsCache.get(
          workspaceId,
        );
        if (cache && cache.has(objectName)) {
          return cache.get(objectName);
        }
        throw new Error(`Validator not found for ${objectName} in ${workspaceId}`);
      });

    repository = new BaseFirestoreRepository(
      'test_fields',
      mockMetadataService,
      'test_workspace',
      admin.app(),
    );
  });

  afterAll(async () => {
    const snapshot = await db.collection('test_fields').get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    mockMetadataService.onModuleDestroy();

    if (admin.apps.length > 0 && admin.app()) {
      await admin.app().delete();
    }

    jest.useFakeTimers();
  });

  beforeEach(async () => {
    const snapshot = await db.collection('test_fields').get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  });

  const validData = {
    objectMetadataId: '123e4567-e89b-12d3-a456-426614174000',
    universalIdentifier: 'my_custom_field',
    name: 'my_custom_field',
    label: 'My Custom Field',
    type: 'TEXT',
  };

  it('should automatically filter by workspaceId from constructor when no context is present', async () => {
    // 1. Create a document with another workspaceId manually in Firestore
    await db.collection('test_fields').add({
        ...validData,
        workspaceId: 'other_workspace',
        name: 'other_doc'
    });

    // 2. Create a document via repository (should use 'test_workspace')
    await repository.create({
        ...validData,
        name: 'repo_doc'
    });

    // 3. Find should only return 'repo_doc'
    const docs = await repository.find();
    expect(docs.length).toBe(1);
    expect(docs[0].name).toBe('repo_doc');
    expect(docs[0].workspaceId).toBe('test_workspace');
  });

  it('should automatically filter by workspaceId from AuthContext when present', async () => {
    await repository.create({ ...validData, name: 'default_doc' });

    const context = {
        type: 'user' as const,
        workspace: { id: 'other_workspace' } as any,
        firebaseWorkspaceId: 'other_workspace',
    };

    await withWorkspaceAuthContext(context, async () => {
        await repository.create({ ...validData, name: 'context_doc' });

        const docs = await repository.find();
        expect(docs.length).toBe(1);
        expect(docs[0].name).toBe('context_doc');
        expect(docs[0].workspaceId).toBe('other_workspace');
    });

    // Back out of context, should see 'default_doc'
    const docs = await repository.find();
    expect(docs.length).toBe(1);
    expect(docs[0].name).toBe('default_doc');
  });

  it('should automatically set workspaceId on create/save', async () => {
    const docRef = await repository.create({ ...validData });
    const doc = await docRef.get();
    expect(doc.data()?.workspaceId).toBe('test_workspace');

    const saved = await repository.save({ ...validData, universalIdentifier: 'saved_doc' });
    expect((saved as any).workspaceId).toBe('test_workspace');

    const context = {
        type: 'user' as const,
        workspace: { id: 'context_workspace' } as any,
        firebaseWorkspaceId: 'context_workspace',
    };

    await withWorkspaceAuthContext(context, async () => {
        const contextDocRef = await repository.create({ ...validData, universalIdentifier: 'context_create' });
        const contextDoc = await contextDocRef.get();
        expect(contextDoc.data()?.workspaceId).toBe('context_workspace');
    });
  });
});
