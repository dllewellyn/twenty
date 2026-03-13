import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Request } from 'express';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { FirebaseAdminService } from 'src/engine/core-modules/firebase/firebase-admin.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { FirebaseAuthStrategy } from './firebase.auth.strategy';

describe('FirebaseAuthStrategy', () => {
  let strategy: FirebaseAuthStrategy;
  let mockFirebaseAdminService: Partial<FirebaseAdminService>;
  let mockUserRepository: any;
  let mockWorkspaceRepository: any;
  let mockUserWorkspaceRepository: any;
  let mockWorkspaceCacheService: any;

  beforeEach(async () => {
    mockFirebaseAdminService = {
      verifyIdToken: jest.fn(),
      setCustomClaims: jest.fn(),
    };
    mockUserRepository = {
      findOne: jest.fn(),
    };
    mockWorkspaceRepository = {
      findOneBy: jest.fn(),
    };
    mockUserWorkspaceRepository = {
      findOne: jest.fn(),
    };
    mockWorkspaceCacheService = {
      getOrRecompute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthStrategy,
        {
          provide: FirebaseAdminService,
          useValue: mockFirebaseAdminService,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: mockWorkspaceRepository,
        },
        {
          provide: getRepositoryToken(UserWorkspaceEntity),
          useValue: mockUserWorkspaceRepository,
        },
        {
          provide: WorkspaceCacheService,
          useValue: mockWorkspaceCacheService,
        },
      ],
    }).compile();

    strategy = module.get<FirebaseAuthStrategy>(FirebaseAuthStrategy);
  });

  describe('validate', () => {
    it('should throw FORBIDDEN_EXCEPTION if no authorization header is present', async () => {
      const request = { headers: {} } as Request;
      await expect(strategy.validate(request)).rejects.toThrow(
        new AuthException(
          'Missing authentication token',
          AuthExceptionCode.FORBIDDEN_EXCEPTION,
        ),
      );
    });

    it('should extract the token (case-insensitive bearer) and verify it', async () => {
      const token = 'valid-firebase-token';
      const request = {
        headers: {
          authorization: `bEarEr ${token}`,
          'x-twenty-workspace-id': 'workspace-id',
        },
      } as unknown as Request;

      (mockFirebaseAdminService.verifyIdToken as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
      });
      mockWorkspaceRepository.findOneBy.mockResolvedValue({
        id: 'workspace-id',
        activationStatus: 'ACTIVE',
      });
      mockUserWorkspaceRepository.findOne.mockResolvedValue({
        id: 'uw-id',
        userId: 'user-id',
        workspaceId: 'workspace-id',
      });
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        flatWorkspaceMemberMaps: {
          idByUserId: { 'user-id': 'wm-id' },
          byId: { 'wm-id': { id: 'wm-id' } },
        },
      });

      const result = await strategy.validate(request);

      expect(mockFirebaseAdminService.verifyIdToken).toHaveBeenCalledWith(
        token,
      );
      expect(result.user.id).toBe('user-id');
      expect(result.workspace.id).toBe('workspace-id');
      expect(result.workspaceMember.id).toBe('wm-id');
    });

    it('should throw FORBIDDEN_EXCEPTION if firebase verification fails', async () => {
      const token = 'invalid-token';
      const request = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;

      (mockFirebaseAdminService.verifyIdToken as jest.Mock).mockRejectedValue(
        new Error('Firebase error'),
      );

      await expect(strategy.validate(request)).rejects.toThrow(
        new AuthException(
          'Invalid or expired token',
          AuthExceptionCode.FORBIDDEN_EXCEPTION,
        ),
      );
    });
  });
});
