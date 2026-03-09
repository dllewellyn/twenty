import { Test, TestingModule } from '@nestjs/testing';
import { MetadataService } from '../metadata.service';
import { FIREBASE_ADMIN_APP } from '../../core-modules/firebase/firebase.constants';

describe('MetadataService', () => {
  let service: MetadataService;
  let mockFirestore: any;

  beforeEach(async () => {
    // Mock for Firestore
    mockFirestore = {
      collection: jest.fn().mockReturnValue({
        onSnapshot: jest.fn(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    };

    const mockFirebaseApp = {
      firestore: jest.fn().mockReturnValue(mockFirestore),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetadataService,
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: mockFirebaseApp,
        },
      ],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should correctly cache and compile json schema validators', async () => {
    const testSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    service.updateCache('workspace1', 'users', testSchema);

    const { validator, partialValidator } = await service.getValidator('users', 'workspace1');

    expect(validator).toBeDefined();
    expect(partialValidator).toBeDefined();

    // The full validator should require 'name'
    expect(validator({})).toBe(false);
    expect(validator({ name: 'test' })).toBe(true);

    // The partial validator should allow omitting required fields
    expect(partialValidator({})).toBe(true);
  });

  it('should clear existing schemas when recompiling to avoid ID conflicts', async () => {
    const testSchema = {
      $id: 'user-schema',
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    service.updateCache('workspace1', 'users', testSchema);

    // Attempting to compile again with the same $id shouldn't throw an error
    // because we implemented `this.ajv.removeSchema` inside `updateCache`
    expect(() => {
      service.updateCache('workspace1', 'users', testSchema);
    }).not.toThrow();
  });

  it('should fallback to system schema if not found in workspace cache', async () => {
    const testSchema = {
      type: 'object',
      properties: {
        systemField: { type: 'boolean' },
      },
    };

    service.updateCache('system', 'config', testSchema);

    // Get validator for 'workspace1' should fall back to 'system' since it's missing in 'workspace1'
    const { validator } = await service.getValidator('config', 'workspace1');
    expect(validator).toBeDefined();
    expect(validator({ systemField: true })).toBe(true);
  });

  it('should fetch from Firestore if missing in caches', async () => {
    // Mock the Firestore to return a document
    const testSchema = {
      type: 'object',
      properties: {
        remoteField: { type: 'string' },
      },
    };

    mockFirestore.collection().get.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            workspaceId: 'workspace1',
            namePlural: 'remote-objects',
            jsonSchema: testSchema,
          }),
        },
      ],
    });

    const { validator } = await service.getValidator('remote-objects', 'workspace1');
    expect(validator).toBeDefined();
    expect(validator({ remoteField: 'test' })).toBe(true);
    expect(mockFirestore.collection().get).toHaveBeenCalledTimes(1);
  });
});
