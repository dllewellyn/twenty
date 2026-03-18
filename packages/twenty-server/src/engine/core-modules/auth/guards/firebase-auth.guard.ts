import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { bindDataToRequestObject } from 'src/engine/utils/bind-data-to-request-object.util';
import { getRequest } from 'src/utils/extract-request';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase-jwt') {
  constructor(
    private readonly workspaceStorageCacheService: WorkspaceCacheStorageService,
  ) {
    super();
  }

  getRequest(context: ExecutionContext) {
    return getRequest(context);
  }

  async handleRequest(
    err: any,
    user: AuthContext,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    const request = this.getRequest(context);
    const authContext = await super.handleRequest(
      err,
      user,
      info,
      context,
      status,
    );

    const metadataVersion = authContext.workspace
      ? await this.workspaceStorageCacheService.getMetadataVersion(
          authContext.workspace.id,
        )
      : undefined;

    bindDataToRequestObject(authContext, request, metadataVersion);

    return request.user;
  }
}
