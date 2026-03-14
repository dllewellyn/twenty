import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuditDataMigrationCommand } from 'src/database/commands/audit-data-migration.command';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

describe('AuditDataMigrationCommand', () => {
  let command: AuditDataMigrationCommand;

  const mockWorkspaceRepository = {
    find: jest.fn(),
  };

  const mockRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockGlobalWorkspaceOrmManager = {
    getRepository: jest.fn().mockResolvedValue(mockRepository),
  };

  const mockDataSourceService = {
    getLastDataSourceMetadataFromWorkspaceId: jest.fn(),
  };

  const mockFirestoreDoc = {
    exists: true,
    data: jest.fn(),
  };

  const mockFirestoreDocRef = {
    get: jest.fn().mockResolvedValue(mockFirestoreDoc),
  };

  const mockFirestoreCount = {
    data: jest.fn(),
  };

  const mockFirestoreWhere = {
    count: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(mockFirestoreCount),
    }),
  };

  const mockFirestoreCollection = {
    where: jest.fn().mockReturnValue(mockFirestoreWhere),
    doc: jest.fn().mockReturnValue(mockFirestoreDocRef),
  };

  const mockFirestore = {
    collection: jest.fn().mockReturnValue(mockFirestoreCollection),
  };

  const mockFirebaseApp = {
    firestore: jest.fn().mockReturnValue(mockFirestore),
  };

  const mockSchemaValidator = {
    validator: jest.fn().mockReturnValue(true),
  };

  const mockMetadataService = {
    getValidator: jest.fn().mockResolvedValue(mockSchemaValidator),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditDataMigrationCommand,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: mockWorkspaceRepository,
        },
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: mockGlobalWorkspaceOrmManager,
        },
        {
          provide: DataSourceService,
          useValue: mockDataSourceService,
        },
        {
          provide: MetadataService,
          useValue: mockMetadataService,
        },
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: mockFirebaseApp,
        },
      ],
    }).compile();

    command = module.get<AuditDataMigrationCommand>(AuditDataMigrationCommand);
    // Suppress console outputs during tests
    command['logger'] = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should log success when counts and sampled data match', async () => {
    const workspaceId = 'test-workspace-id';

    // Postgres mocks
    mockRepository.count.mockResolvedValue(2);
    const pgRecords = [
      { id: '1', createdAt: new Date('2023-01-01T00:00:00.000Z') },
      { id: '2', createdAt: new Date('2023-01-02T00:00:00.000Z') },
    ];
    mockRepository.find.mockResolvedValue(pgRecords);

    // Firestore mocks
    mockFirestoreCount.data.mockReturnValue({ count: 2 });
    mockFirestoreDoc.exists = true;
    mockFirestoreDoc.data
      .mockReturnValueOnce({
        id: '1',
        createdAt: '2023-01-01T00:00:00.000Z',
      })
      .mockReturnValueOnce({
        id: '2',
        createdAt: '2023-01-02T00:00:00.000Z',
      });

    await command.runOnWorkspace({
      workspaceId,
      options: { workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(mockGlobalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      workspaceId,
      'person',
    );
    expect(mockFirestore.collection).toHaveBeenCalledWith('people');
    expect(mockFirestoreCollection.where).toHaveBeenCalledWith(
      'workspaceId',
      '==',
      workspaceId,
    );

    // Check if green match text was logged for each collection
    expect(command['logger'].log).toHaveBeenCalledWith(
      expect.stringContaining('Count matches: 2 records.'),
    );
  });

  it('should log mismatch when counts differ', async () => {
    const workspaceId = 'test-workspace-id';

    mockRepository.count.mockResolvedValue(5);
    mockFirestoreCount.data.mockReturnValue({ count: 3 });
    mockRepository.find.mockResolvedValue([]);

    await command.runOnWorkspace({
      workspaceId,
      options: { workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(command['logger'].log).toHaveBeenCalledWith(
      expect.stringContaining('Count mismatch: Postgres = 5, Firestore = 3.'),
    );
  });

  it('should log error when sampled document is missing in Firestore', async () => {
    const workspaceId = 'test-workspace-id';

    mockRepository.count.mockResolvedValue(1);
    mockFirestoreCount.data.mockReturnValue({ count: 1 });
    mockRepository.find.mockResolvedValue([{ id: 'missing-id' }]);

    mockFirestoreDoc.exists = false;

    await command.runOnWorkspace({
      workspaceId,
      options: { workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(command['logger'].log).toHaveBeenCalledWith(
      expect.stringContaining('missing in Firestore'),
    );
  });

  it('should log error when sampled document data mismatches', async () => {
    const workspaceId = 'test-workspace-id';

    mockRepository.count.mockResolvedValue(1);
    mockFirestoreCount.data.mockReturnValue({ count: 1 });

    const date = new Date('2023-01-01T00:00:00.000Z');
    mockRepository.find.mockResolvedValue([{ id: '1', createdAt: date }]);

    mockFirestoreDoc.exists = true;
    mockFirestoreDoc.data.mockReturnValue({ id: '1', createdAt: '2023-01-02T00:00:00.000Z' });

    await command.runOnWorkspace({
      workspaceId,
      options: { workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(command['logger'].log).toHaveBeenCalledWith(
      expect.stringContaining('mismatch on createdAt'),
    );
  });

  it('should log schema validation errors', async () => {
    const workspaceId = 'test-workspace-id';

    mockRepository.count.mockResolvedValue(1);
    mockFirestoreCount.data.mockReturnValue({ count: 1 });

    const date = new Date('2023-01-01T00:00:00.000Z');
    mockRepository.find.mockResolvedValue([{ id: '1', createdAt: date }]);

    mockFirestoreDoc.exists = true;
    mockFirestoreDoc.data.mockReturnValue({ id: '1', createdAt: '2023-01-01T00:00:00.000Z' });

    mockSchemaValidator.validator.mockReturnValueOnce(false);
    mockSchemaValidator.validator['errors'] = [{ message: 'Missing property name' }];

    await command.runOnWorkspace({
      workspaceId,
      options: { workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(command['logger'].log).toHaveBeenCalledWith(
      expect.stringContaining('failed schema validation'),
    );
  });

  it('should log relationship mismatches', async () => {
    const workspaceId = 'test-workspace-id';

    mockRepository.count.mockResolvedValue(1);
    mockFirestoreCount.data.mockReturnValue({ count: 1 });

    const date = new Date('2023-01-01T00:00:00.000Z');
    mockRepository.find.mockResolvedValue([{ id: '1', createdAt: date, companyId: 'pg-company-1' }]);

    mockFirestoreDoc.exists = true;
    mockFirestoreDoc.data.mockReturnValue({ id: '1', createdAt: '2023-01-01T00:00:00.000Z', companyId: 'fs-company-2' });

    mockSchemaValidator.validator.mockReturnValueOnce(true);

    await command.runOnWorkspace({
      workspaceId,
      options: { workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(command['logger'].log).toHaveBeenCalledWith(
      expect.stringContaining('mismatch on relation companyId'),
    );
  });
});
