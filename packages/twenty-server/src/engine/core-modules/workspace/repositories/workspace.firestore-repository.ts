import { Injectable } from '@nestjs/common';

import { Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';

@Injectable()
export class WorkspaceFirestoreRepository extends BaseFirestoreRepository<WorkspaceEntity> {
  constructor(
    metadataService: MetadataService,
    @Inject(FIREBASE_ADMIN_APP) firebaseApp?: admin.app.App,
  ) {
    // Workspace metadata is globally accessible or stored under a system-level workspace ID
    super('workspaces', metadataService, 'system', firebaseApp);
  }
}
