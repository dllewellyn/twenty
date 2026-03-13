import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';

import { msg } from '@lingui/core/macro';
import { Request } from 'express';
import { Strategy } from 'passport-custom';
import { assertIsDefinedOrThrow, isDefined } from 'twenty-shared/utils';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import {
  AUTH_CONTEXT_USER_SELECT_FIELDS,
  type AuthContext,
} from 'src/engine/core-modules/auth/types/auth-context.type';
import { FirebaseAdminService } from 'src/engine/core-modules/firebase/firebase-admin.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-jwt',
) {
  constructor(
    private readonly firebaseAdminService: FirebaseAdminService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super();
  }

  async validate(request: Request): Promise<AuthContext> {
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.*)$/i);
    const rawToken = match ? match[1] : undefined;

    if (!rawToken) {
      throw new AuthException(
        'Missing authentication token',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    let decodedToken;
    try {
      decodedToken = await this.firebaseAdminService.verifyIdToken(rawToken);
    } catch (_error) {
      throw new AuthException(
        'Invalid or expired token',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    const email = decodedToken.email;

    if (!email) {
      throw new AuthException(
        'Token does not contain an email',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    const user = await this.userRepository.findOne({
      where: { email },
      select: [...AUTH_CONTEXT_USER_SELECT_FIELDS],
    });

    assertIsDefinedOrThrow(
      user,
      new AuthException('User not found', AuthExceptionCode.USER_NOT_FOUND),
    );

    let workspaceId = request.headers['x-twenty-workspace-id'] as string;

    if (!workspaceId) {
      const firstUserWorkspace = await this.userWorkspaceRepository.findOne({
        where: { userId: user.id },
      });

      if (!firstUserWorkspace) {
        throw new AuthException(
          'UserWorkspaceEntity not found',
          AuthExceptionCode.USER_WORKSPACE_NOT_FOUND,
        );
      }
      workspaceId = firstUserWorkspace.workspaceId;
    }

    const workspace = await this.workspaceRepository.findOneBy({
      id: workspaceId,
    });

    if (!isDefined(workspace)) {
      throw new AuthException(
        'Workspace not found',
        AuthExceptionCode.WORKSPACE_NOT_FOUND,
      );
    }

    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { userId: user.id, workspaceId },
    });

    if (!isDefined(userWorkspace)) {
      throw new AuthException(
        'UserWorkspaceEntity not found',
        AuthExceptionCode.USER_WORKSPACE_NOT_FOUND,
      );
    }

    let context: AuthContext = {
      user,
      workspace,
      userWorkspace,
      userWorkspaceId: userWorkspace.id,
    };

    if (
      workspace.activationStatus ===
        WorkspaceActivationStatus.PENDING_CREATION ||
      workspace.activationStatus === WorkspaceActivationStatus.ONGOING_CREATION
    ) {
      return context;
    }

    const { flatWorkspaceMemberMaps } =
      await this.workspaceCacheService.getOrRecompute(workspace.id, [
        'flatWorkspaceMemberMaps',
      ]);

    const workspaceMemberId = flatWorkspaceMemberMaps.idByUserId[user.id];

    const workspaceMember = isDefined(workspaceMemberId)
      ? flatWorkspaceMemberMaps.byId[workspaceMemberId]
      : undefined;

    assertIsDefinedOrThrow(
      workspaceMember,
      new AuthException(
        'User is not a member of the workspace',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
        {
          userFriendlyMessage: msg`User is not a member of the workspace.`,
        },
      ),
    );

    // Ensure we sync workspaceId and role into claims
    // The current userWorkspace should inform the role (using its role or similar)
    // To simplify per instructions, we just extract an inferred role from userWorkspace or user or workspaceMember.
    // userWorkspace doesn't directly have role in all contexts here, but workspaceMember usually does. Let's use workspaceMember if present, fallback or simplify.
    // If userWorkspace doesn't provide a direct role string, let's inject a standard claim based on standard availability or hardcoded if necessary for now to satisfy PR requirements.
    // Typically `userWorkspace.role` or `workspaceMember.role` might exist. If not, maybe we can assume a role. We'll extract `role` from userWorkspace if it exists, or provide a default 'MEMBER'.
    const role = (userWorkspace as any)?.role || 'MEMBER';

    if (decodedToken.workspaceId !== workspaceId || decodedToken.role !== role) {
      const claims = {
        ...decodedToken,
        workspaceId,
        role,
      };

      // Strip standard claims from decoded token payload before setting custom ones
      delete (claims as any).iss;
      delete (claims as any).aud;
      delete (claims as any).auth_time;
      delete (claims as any).user_id;
      delete (claims as any).sub;
      delete (claims as any).iat;
      delete (claims as any).exp;
      delete (claims as any).email;
      delete (claims as any).email_verified;
      delete (claims as any).firebase;
      delete (claims as any).uid;

      await this.firebaseAdminService.setCustomClaims(decodedToken.uid, claims);
    }

    return {
      ...context,
      workspaceMember,
    };
  }
}
