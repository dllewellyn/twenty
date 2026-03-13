import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MigrateUsersCommand } from 'src/database/commands/migrate-users.command';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';

jest.mock('src/engine/twenty-orm/repository/firestore.repository');

describe('MigrateUsersCommand', () => {
  let command: MigrateUsersCommand;
  let metadataService: jest.Mocked<MetadataService>;

  const mockUserRepository = {
    find: jest.fn(),
  };

  const mockFirestoreRepository = {
    save: jest.fn(),
  };

  const mockFirestoreMetadataCollectionAdd = jest.fn();
  const mockFirestoreMetadataSnapshot = {
    empty: true,
  };

  const mockFirestore = {
    collection: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(mockFirestoreMetadataSnapshot),
      add: mockFirestoreMetadataCollectionAdd,
    }),
  };

  const mockFirebaseApp = {
    firestore: jest.fn().mockReturnValue(mockFirestore),
  };

  (BaseFirestoreRepository as jest.Mock).mockImplementation(
    () => mockFirestoreRepository,
  );

  beforeEach(async () => {
    metadataService = {} as any;
    mockFirestoreMetadataSnapshot.empty = true; // reset to true by default

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrateUsersCommand,
        {
          provide: getRepositoryToken(UserEntity, 'core'),
          useValue: mockUserRepository,
        },
        {
          provide: MetadataService,
          useValue: metadataService,
        },
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: mockFirebaseApp,
        },
      ],
    }).compile();

    command = module.get<MigrateUsersCommand>(MigrateUsersCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should seed metadata if it does not exist', async () => {
    mockUserRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runMigrationCommand([], { dryRun: false });

    expect(mockFirestore.collection).toHaveBeenCalledWith('_metadata');
    expect(mockFirestoreMetadataCollectionAdd).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully seeded metadata for users.',
    );
  });

  it('should not seed metadata if it already exists', async () => {
    mockFirestoreMetadataSnapshot.empty = false;
    mockUserRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runMigrationCommand([], { dryRun: false });

    expect(mockFirestoreMetadataCollectionAdd).not.toHaveBeenCalled();
    expect(loggerSpy).not.toHaveBeenCalledWith(
      'Successfully seeded metadata for users.',
    );
  });

  it('should properly transform UserEntity to plain object', async () => {
    mockFirestoreMetadataSnapshot.empty = false;
    const dateStr = '2024-01-01T00:00:00.000Z';
    const dateObj = new Date(dateStr);

    const mockUsers = [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwordHash: 'secret',
        createdAt: dateObj,
        updatedAt: dateObj,
        appTokens: [],
        keyValuePairs: [],
        userWorkspaces: [],
        workspaceMember: {},
        currentWorkspace: {},
        currentUserWorkspace: {},
        formatEmail: () => {},
      },
    ];

    mockUserRepository.find.mockResolvedValue(mockUsers);

    await command.runMigrationCommand([], { dryRun: false });

    expect(mockFirestoreRepository.save).toHaveBeenCalledWith([
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        emails: [{ email: 'john@example.com', primary: true }],
        createdAt: dateStr,
        updatedAt: dateStr,
        deletedAt: undefined,
      },
    ]);
  });

  it('should chunk the migrations up correctly according to FIRESTORE_BATCH_LIMIT', async () => {
    mockFirestoreMetadataSnapshot.empty = false;
    const mockUsers = Array.from({ length: 1200 }, (_, i) => ({
      id: `user-${i}`,
      firstName: `First${i}`,
      email: `user${i}@example.com`,
      passwordHash: 'secret',
    }));

    mockUserRepository.find.mockResolvedValue(mockUsers);

    await command.runMigrationCommand([], { dryRun: false });

    const expectedChunks = mockUsers.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      emails: [{ email: u.email, primary: true }],
      createdAt: undefined,
      updatedAt: undefined,
      deletedAt: undefined,
    }));

    expect(mockFirestoreRepository.save).toHaveBeenCalledTimes(3);
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      1,
      expectedChunks.slice(0, 500),
    );
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      2,
      expectedChunks.slice(500, 1000),
    );
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      3,
      expectedChunks.slice(1000, 1200),
    );
  });

  it('should not save if dryRun is true', async () => {
    mockFirestoreMetadataSnapshot.empty = true;
    const mockUsers = [{ id: '1', firstName: 'John' }];
    mockUserRepository.find.mockResolvedValue(mockUsers);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runMigrationCommand([], { dryRun: true });

    expect(mockFirestoreMetadataCollectionAdd).not.toHaveBeenCalled();
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would seed metadata for users in workspace system.',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would migrate 1 users to Firestore.',
    );
  });
});
