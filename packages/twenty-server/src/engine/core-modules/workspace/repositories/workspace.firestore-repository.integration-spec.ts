import { WorkspaceFirestoreRepository } from 'src/engine/core-modules/workspace/repositories/workspace.firestore-repository';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import * as admin from 'firebase-admin';

describe('WorkspaceFirestoreRepository (Integration)', () => {
  let repository: WorkspaceFirestoreRepository;
  let mockMetadataService: Partial<MetadataService>;
  let createdDocId: string;

  beforeAll(() => {
    // Explicitly use real timers for gRPC / Firestore compatibility
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockMetadataService = {
      getValidator: jest.fn().mockResolvedValue({
        validator: () => true, // Mock valid ajv schema for all properties
        partialValidator: () => true, // Mock valid ajv schema for partial updates
      }),
    };

    // 'system' is the workspaceId for the global metadata
    repository = new WorkspaceFirestoreRepository(
      mockMetadataService as MetadataService,
    );
  });

  afterAll(async () => {
    if (createdDocId) {
      await repository.delete(createdDocId);
    }
  });

  it('should create and find a workspace', async () => {
    const validData = {
      displayName: 'Test Workspace',
      subdomain: 'test-workspace',
      isActive: true,
      customDomain: null,
    };

    // 1. Create
    const docRef = await repository.create(validData as any);
    expect(docRef).toBeDefined();
    expect(docRef.id).toBeDefined();
    createdDocId = docRef.id;

    // 2. Read (findOne)
    const fetchedDoc = await repository.findOne(createdDocId);
    expect(fetchedDoc).toBeDefined();
    expect(fetchedDoc?.displayName).toBe(validData.displayName);
    expect(fetchedDoc?.subdomain).toBe(validData.subdomain);
  });

  it('should update an existing workspace', async () => {
    const updateData = { displayName: 'Updated Test Workspace' };
    await repository.update(createdDocId, updateData);

    const updatedDoc = await repository.findOne(createdDocId);
    expect(updatedDoc?.displayName).toBe('Updated Test Workspace');
  });

  it('should delete an existing workspace', async () => {
    await repository.delete(createdDocId);

    const deletedDoc = await repository.findOne(createdDocId);
    expect(deletedDoc).toBeNull();

    // Prevent afterAll from trying to delete it again
    createdDocId = '';
  });
});
