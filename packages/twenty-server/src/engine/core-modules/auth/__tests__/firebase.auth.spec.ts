import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Request } from 'express';

import { AuthException } from 'src/engine/core-modules/auth/auth.exception';

import { FirebaseAuthStrategy } from 'src/engine/core-modules/auth/strategies/firebase.auth.strategy';
import { FirebaseAdminService } from 'src/engine/core-modules/firebase/firebase-admin.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

describe('FirebaseAuthStrategy & FirebaseAuthGuard', () => {
  let strategy: FirebaseAuthStrategy;
  let firebaseAdminService: any;
  let userRepository: any;
  let workspaceRepository: any;
  let userWorkspaceRepository: any;
  let workspaceCacheService: any;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
    };
    workspaceRepository = {
      findOneBy: jest.fn(),
    };
    userWorkspaceRepository = {
      findOne: jest.fn(),
    };
    workspaceCacheService = {
      getOrRecompute: jest.fn().mockResolvedValue({
        flatWorkspaceMemberMaps: {
          idByUserId: { 'user-1': 'member-1' },
          byId: { 'member-1': { id: 'member-1' } },
        },
      }),
    };
    firebaseAdminService = {
      verifyIdToken: jest.fn(),
      setCustomClaims: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthStrategy,
        {
          provide: FirebaseAdminService,
          useValue: firebaseAdminService,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: workspaceRepository,
        },
        {
          provide: getRepositoryToken(UserWorkspaceEntity),
          useValue: userWorkspaceRepository,
        },
        {
          provide: WorkspaceCacheService,
          useValue: workspaceCacheService,
        },
      ],
    }).compile();

    strategy = module.get<FirebaseAuthStrategy>(FirebaseAuthStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const validRequest = {
      headers: {
        authorization: 'Bearer valid.token',
        'x-twenty-workspace-id': 'workspace-1',
      },
    } as unknown as Request;

    it('should throw AuthException if token is missing', async () => {
      const request = { headers: {} } as Request;
      await expect(strategy.validate(request)).rejects.toThrow(AuthException);
    });

    it('should throw AuthException if token verification fails', async () => {
      firebaseAdminService.verifyIdToken.mockRejectedValue(
        new Error('Invalid token'),
      );
      await expect(strategy.validate(validRequest)).rejects.toThrow(
        AuthException,
      );
    });

    it('should throw AuthException if token has no email', async () => {
      firebaseAdminService.verifyIdToken.mockResolvedValue({
        uid: 'user-uid',
      });
      await expect(strategy.validate(validRequest)).rejects.toThrow(
        AuthException,
      );
    });

    it('should resolve AuthContext successfully', async () => {
      firebaseAdminService.verifyIdToken.mockResolvedValue({
        email: 'test@example.com',
      });

      const mockUser = { id: 'user-1', email: 'test@example.com' };
      userRepository.findOne.mockResolvedValue(mockUser);

      const mockWorkspace = { id: 'workspace-1', activationStatus: 'ACTIVE' };
      workspaceRepository.findOneBy.mockResolvedValue(mockWorkspace);

      const mockUserWorkspace = {
        id: 'uw-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      };
      userWorkspaceRepository.findOne.mockResolvedValue(mockUserWorkspace);

      const context = await strategy.validate(validRequest);

      expect(context.user).toEqual(mockUser);
      expect(context.workspace).toEqual(mockWorkspace);
      expect(context.userWorkspace).toEqual(mockUserWorkspace);
      expect(context.workspaceMember).toEqual({ id: 'member-1' });
    });

    it('should resolve workspace via first user workspace if header is missing', async () => {
      const reqWithoutHeader = {
        headers: {
          authorization: 'Bearer valid.token',
        },
      } as unknown as Request;

      firebaseAdminService.verifyIdToken.mockResolvedValue({
        email: 'test@example.com',
      });

      const mockUser = { id: 'user-1', email: 'test@example.com' };
      userRepository.findOne.mockResolvedValue(mockUser);

      const mockFirstUserWorkspace = {
        id: 'uw-1',
        userId: 'user-1',
        workspaceId: 'first-workspace',
      };

      userWorkspaceRepository.findOne.mockResolvedValue(mockFirstUserWorkspace);

      const mockWorkspace = {
        id: 'first-workspace',
        activationStatus: 'ACTIVE',
      };
      workspaceRepository.findOneBy.mockResolvedValue(mockWorkspace);

      const context = await strategy.validate(reqWithoutHeader);

      expect(context.workspace).toEqual(mockWorkspace);
      expect(context.userWorkspace).toEqual(mockFirstUserWorkspace);
    });
  });
});
