import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { VerifyFirebaseUsersCommand } from 'src/database/commands/verify-firebase-users.command';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';

describe('VerifyFirebaseUsersCommand', () => {
  let command: VerifyFirebaseUsersCommand;
  let firebaseAppMock: any;
  let firestoreMock: any;
  let authMock: any;
  let loggerSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    firestoreMock = {
      collection: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    authMock = {
      getUserByEmail: jest.fn(),
    };

    firebaseAppMock = {
      firestore: jest.fn().mockReturnValue(firestoreMock),
      auth: jest.fn().mockReturnValue(authMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyFirebaseUsersCommand,
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: firebaseAppMock,
        },
      ],
    }).compile();

    command = module.get<VerifyFirebaseUsersCommand>(
      VerifyFirebaseUsersCommand,
    );

    // Spy on protected logger
    loggerSpy = jest.spyOn((command as any).logger, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn((command as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should log when no users are found in Firestore', async () => {
    firestoreMock.get.mockResolvedValueOnce({ empty: true });

    await command.run([], {});

    expect(firestoreMock.collection).toHaveBeenCalledWith('users');
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fetching users from Firestore'),
    );
    expect(loggerSpy).toHaveBeenCalledWith('No users found in Firestore.');
    expect(authMock.getUserByEmail).not.toHaveBeenCalled();
  });

  it('should correctly count users found and not found in Firebase Auth', async () => {
    const docs = [
      {
        id: '1',
        data: () => ({
          emails: [{ email: 'found@example.com', primary: true }],
        }),
      },
      {
        id: '2',
        data: () => ({
          emails: [{ email: 'notfound@example.com', primary: true }],
        }),
      },
      {
        id: '3',
        data: () => ({
          emails: [{ email: 'no-primary@example.com', primary: false }],
        }),
      },
      {
        id: '4',
        data: () => ({
          // No emails
        }),
      },
    ];

    firestoreMock.get.mockResolvedValueOnce({
      empty: false,
      size: docs.length,
      docs,
    });

    authMock.getUserByEmail.mockImplementation(async (email: string) => {
      if (email === 'found@example.com') {
        return { uid: 'some-uid', email };
      }
      const error = new Error('User not found');
      (error as any).code = 'auth/user-not-found';
      throw error;
    });

    await command.run([], {});

    expect(authMock.getUserByEmail).toHaveBeenCalledTimes(2);
    expect(authMock.getUserByEmail).toHaveBeenCalledWith('found@example.com');
    expect(authMock.getUserByEmail).toHaveBeenCalledWith('notfound@example.com');

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('- Found in Firebase Auth: 1'),
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('- Not found in Firebase Auth: 1'),
    );
  });

  it('should log error when auth.getUserByEmail throws an unknown error', async () => {
    const docs = [
      {
        id: '1',
        data: () => ({
          emails: [{ email: 'error@example.com', primary: true }],
        }),
      },
    ];

    firestoreMock.get.mockResolvedValueOnce({
      empty: false,
      size: docs.length,
      docs,
    });

    const unknownError = new Error('Unknown error');
    authMock.getUserByEmail.mockRejectedValueOnce(unknownError);

    await command.run([], {});

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Error checking user error@example.com:',
      unknownError,
    );
  });

  it('should rethrow if an overall error occurs', async () => {
    const dbError = new Error('Database error');
    firestoreMock.get.mockRejectedValueOnce(dbError);

    await expect(command.run([], {})).rejects.toThrow('Database error');
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to verify users.',
      dbError,
    );
  });
});
