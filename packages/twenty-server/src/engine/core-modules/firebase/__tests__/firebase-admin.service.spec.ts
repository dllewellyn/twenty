import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase-admin.service';
import { FIREBASE_ADMIN_APP } from '../firebase.constants';
import * as admin from 'firebase-admin';

describe('FirebaseAdminService', () => {
  let service: FirebaseAdminService;
  let mockFirebaseApp: any;

  beforeEach(async () => {
    mockFirebaseApp = {
      auth: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAdminService,
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: mockFirebaseApp,
        },
      ],
    }).compile();

    service = module.get<FirebaseAdminService>(FirebaseAdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('auth', () => {
    it('should return firebase auth instance', () => {
      const mockAuthInstance = {};
      mockFirebaseApp.auth.mockReturnValue(mockAuthInstance);

      expect(service.auth).toBe(mockAuthInstance);
      expect(mockFirebaseApp.auth).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when auth initialization fails', () => {
      mockFirebaseApp.auth.mockImplementation(() => {
        throw new Error('Firebase not initialized');
      });

      expect(() => service.auth).toThrow(InternalServerErrorException);
      expect(() => service.auth).toThrow('Failed to initialize Firebase Auth');
    });
  });

  describe('verifyIdToken', () => {
    it('should successfully verify token', async () => {
      const mockDecodedToken = { uid: '123' } as admin.auth.DecodedIdToken;
      const mockAuthInstance = {
        verifyIdToken: jest.fn().mockResolvedValue(mockDecodedToken),
      };
      mockFirebaseApp.auth.mockReturnValue(mockAuthInstance);

      const result = await service.verifyIdToken('valid-token');

      expect(result).toBe(mockDecodedToken);
      expect(mockAuthInstance.verifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw error when verification fails', async () => {
      const mockError = new Error('Invalid token');
      const mockAuthInstance = {
        verifyIdToken: jest.fn().mockRejectedValue(mockError),
      };
      mockFirebaseApp.auth.mockReturnValue(mockAuthInstance);

      await expect(service.verifyIdToken('invalid-token')).rejects.toThrow(mockError);
    });
  });
});
