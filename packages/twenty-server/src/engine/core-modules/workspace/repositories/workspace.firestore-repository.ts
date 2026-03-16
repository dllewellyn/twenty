import { Injectable } from '@nestjs/common';

import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';

@Injectable()
export class WorkspaceFirestoreRepository extends BaseFirestoreRepository<WorkspaceEntity> {
  constructor(metadataService: MetadataService) {
    // Workspace metadata is likely globally accessible or stored under a system-level workspace ID
    super('workspaces', metadataService, 'system');
  }
}
