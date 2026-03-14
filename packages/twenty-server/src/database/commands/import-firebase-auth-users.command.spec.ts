import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ImportFirebaseAuthUsersCommand } from 'src/database/commands/import-firebase-auth-users.command';
import { FirebaseAdminService } from 'src/engine/core-modules/firebase/firebase-admin.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

describe('ImportFirebaseAuthUsersCommand', () => {
  let command: ImportFirebaseAuthUsersCommand;
  let userRepositoryMock: any;
  let firebaseAdminServiceMock: any;
  let importUsersMock: jest.Mock;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    userRepositoryMock = {
      find: jest.fn(),
    };

    importUsersMock = jest.fn().mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      errors: [],
    });

    firebaseAdminServiceMock = {
      auth: {
        importUsers: importUsersMock,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportFirebaseAuthUsersCommand,
        {
          provide: getRepositoryToken(UserEntity, 'core'),
          useValue: userRepositoryMock,
        },
        {
          provide: FirebaseAdminService,
          useValue: firebaseAdminServiceMock,
        },
      ],
    }).compile();

    command = module.get<ImportFirebaseAuthUsersCommand>(
      ImportFirebaseAuthUsersCommand,
    );

    loggerLogSpy = jest.spyOn((command as any).logger, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn((command as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should log when no users are found', async () => {
    userRepositoryMock.find.mockResolvedValueOnce([]);

    await command.run([], {});

    expect(loggerLogSpy).toHaveBeenCalledWith('No users found to import.');
    expect(importUsersMock).not.toHaveBeenCalled();
  });

  it('should map users correctly and perform dry run', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        passwordHash: 'hash1',
        isEmailVerified: true,
        disabled: false,
        firstName: 'John',
        lastName: 'Doe',
      },
      {
        id: 'user2',
        email: 'user2@example.com',
        passwordHash: 'hash2',
        isEmailVerified: false,
        disabled: true,
        firstName: 'Jane',
        lastName: 'Smith',
      },
    ];

    userRepositoryMock.find.mockResolvedValueOnce(mockUsers);

    await command.run([], { dryRun: true });

    expect(loggerLogSpy).toHaveBeenCalledWith(
      `[DRY RUN] Would import ${mockUsers.length} users into Firebase Auth.`,
    );
    expect(importUsersMock).not.toHaveBeenCalled();
  });

  it('should map users correctly and import them into Firebase Auth', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        passwordHash: 'hash1',
        isEmailVerified: true,
        disabled: false,
        firstName: 'John',
        lastName: 'Doe',
      },
    ];

    userRepositoryMock.find.mockResolvedValueOnce(mockUsers);
    importUsersMock.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      errors: [],
    });

    await command.run([], {});

    expect(importUsersMock).toHaveBeenCalledTimes(1);
    expect(importUsersMock).toHaveBeenCalledWith(
      [
        {
          uid: 'user1',
          email: 'user1@example.com',
          passwordHash: Buffer.from('hash1'),
          emailVerified: true,
          disabled: false,
          displayName: 'John Doe',
        },
      ],
      { hash: { algorithm: 'BCRYPT' } },
    );
    expect(loggerLogSpy).toHaveBeenCalledWith('Summary:');
    expect(loggerLogSpy).toHaveBeenCalledWith('Total Processed: 1');
    expect(loggerLogSpy).toHaveBeenCalledWith('Success Count: 1');
    expect(loggerLogSpy).toHaveBeenCalledWith('Failure Count: 0');
  });

  it('should batch users for import if more than 1000 users exist', async () => {
    const mockUsers = Array.from({ length: 1500 }).map((_, i) => ({
      id: `user${i}`,
      email: `user${i}@example.com`,
      passwordHash: `hash${i}`,
      isEmailVerified: true,
      disabled: false,
      firstName: `User`,
      lastName: `${i}`,
    }));

    userRepositoryMock.find.mockResolvedValueOnce(mockUsers);
    importUsersMock
      .mockResolvedValueOnce({ successCount: 1000, failureCount: 0, errors: [] })
      .mockResolvedValueOnce({ successCount: 500, failureCount: 0, errors: [] });

    await command.run([], {});

    expect(importUsersMock).toHaveBeenCalledTimes(2);

    // First call with first 1000
    expect(importUsersMock).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([expect.objectContaining({ uid: 'user0' })]),
      { hash: { algorithm: 'BCRYPT' } }
    );
    const call1Args = importUsersMock.mock.calls[0][0];
    expect(call1Args.length).toBe(1000);

    // Second call with remaining 500
    expect(importUsersMock).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([expect.objectContaining({ uid: 'user1000' })]),
      { hash: { algorithm: 'BCRYPT' } }
    );
    const call2Args = importUsersMock.mock.calls[1][0];
    expect(call2Args.length).toBe(500);

    expect(loggerLogSpy).toHaveBeenCalledWith('Summary:');
    expect(loggerLogSpy).toHaveBeenCalledWith('Total Processed: 1500');
    expect(loggerLogSpy).toHaveBeenCalledWith('Success Count: 1500');
    expect(loggerLogSpy).toHaveBeenCalledWith('Failure Count: 0');
  });

  it('should log errors for individual failed user imports', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        passwordHash: 'hash1',
        isEmailVerified: true,
        disabled: false,
        firstName: 'John',
        lastName: 'Doe',
      },
    ];

    userRepositoryMock.find.mockResolvedValueOnce(mockUsers);

    const mockError = { index: 0, error: new Error('Some error') };
    importUsersMock.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 1,
      errors: [mockError],
    });

    await command.run([], {});

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to import user at index 0 in chunk 0:',
      mockError.error,
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith('Failure Count: 1');
  });
});
