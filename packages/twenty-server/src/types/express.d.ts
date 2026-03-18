import { type ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context-user.type';
import { type UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { type AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

declare global {
  namespace Express {
    interface Request {
      user?: AuthContextUser;
      firebaseUid?: string;
      firebaseWorkspaceId?: string;
      apiKey?: ApiKeyEntity;
      application?: ApplicationEntity;
      userWorkspace?: UserWorkspaceEntity;
      workspace?: WorkspaceEntity;
      workspaceId?: string;
      workspaceMetadataVersion?: number;
      workspaceMemberId?: string;
      workspaceMember?: WorkspaceMemberWorkspaceEntity;
      userWorkspaceId?: string;
      authProvider?: AuthProviderEnum;
      impersonationContext?: {
        impersonatorUserWorkspaceId?: string;
        impersonatedUserWorkspaceId?: string;
      };
      locale?: string;
    }
  }
}
