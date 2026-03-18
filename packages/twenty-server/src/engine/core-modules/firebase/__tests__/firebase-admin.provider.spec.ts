import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { FirebaseAdminProvider } from '../firebase-admin.provider';
import { TwentyConfigService } from '../../twenty-config/twenty-config.service';

jest.mock('firebase-admin', () => ({
  apps: [],
  app: jest.fn(),
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
    applicationDefault: jest.fn(),
  },
}));

describe('FirebaseAdminProvider', () => {
  let mockConfigService: jest.Mocked<TwentyConfigService>;
  const loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService = {
      get: jest.fn(),
    } as any;
  });

  it('should initialize Firebase Admin SDK using individual environment variables', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'FIREBASE_PROJECT_ID') return 'test-project';
      if (key === 'FIREBASE_DATABASE_URL') return 'https://test.firebaseio.com';
      return null;
    });

    (admin.credential.applicationDefault as jest.Mock).mockReturnValue('default-cred');

    const factory = (FirebaseAdminProvider as any).useFactory;
    factory(mockConfigService);

    expect(admin.initializeApp).toHaveBeenCalledWith({
      credential: 'default-cred',
      projectId: 'test-project',
      databaseURL: 'https://test.firebaseio.com',
    });
  });

  it('should initialize Firebase Admin SDK using FIREBASE_CONFIG JSON string', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'FIREBASE_CONFIG') {
        return JSON.stringify({
          projectId: 'config-project',
          databaseURL: 'https://config.firebaseio.com',
        });
      }
      return null;
    });

    (admin.credential.applicationDefault as jest.Mock).mockReturnValue('default-cred');

    const factory = (FirebaseAdminProvider as any).useFactory;
    factory(mockConfigService);

    expect(admin.initializeApp).toHaveBeenCalledWith({
      credential: 'default-cred',
      projectId: 'config-project',
      databaseURL: 'https://config.firebaseio.com',
    });
    expect(loggerLogSpy).toHaveBeenCalledWith('Initializing Firebase Admin SDK using FIREBASE_CONFIG');
  });

  it('should prioritize individual environment variables over FIREBASE_CONFIG', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'FIREBASE_PROJECT_ID') return 'explicit-project';
      if (key === 'FIREBASE_CONFIG') {
        return JSON.stringify({
          projectId: 'config-project',
          databaseURL: 'https://config.firebaseio.com',
        });
      }
      return null;
    });

    (admin.credential.applicationDefault as jest.Mock).mockReturnValue('default-cred');

    const factory = (FirebaseAdminProvider as any).useFactory;
    factory(mockConfigService);

    expect(admin.initializeApp).toHaveBeenCalledWith({
      credential: 'default-cred',
      projectId: 'explicit-project',
      databaseURL: 'https://config.firebaseio.com',
    });
  });

  it('should handle invalid FIREBASE_CONFIG JSON gracefully', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'FIREBASE_CONFIG') return 'invalid-json';
      return null;
    });

    (admin.credential.applicationDefault as jest.Mock).mockReturnValue('default-cred');

    const factory = (FirebaseAdminProvider as any).useFactory;
    factory(mockConfigService);

    expect(admin.initializeApp).toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to parse FIREBASE_CONFIG', expect.any(Error));
  });
});
