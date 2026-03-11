import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Command } from 'nest-commander';
import { Repository } from 'typeorm';

import { ActiveOrSuspendedWorkspacesMigrationCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspaces-migration.command-runner';
import { RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspaces-migration.command-runner';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';
import { NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';

@Command({
  name: 'database:migrate-note-targets',
  description: 'Migrates note targets records from PostgreSQL to Firestore.',
})
export class MigrateNoteTargetsCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
  constructor(
    @InjectRepository(WorkspaceEntity)
    protected readonly workspaceRepository: Repository<WorkspaceEntity>,
    protected readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    protected readonly dataSourceService: DataSourceService,
    protected readonly metadataService: MetadataService,
    @Inject(FIREBASE_ADMIN_APP)
    protected readonly firebaseApp: admin.app.App,
  ) {
    super(workspaceRepository, globalWorkspaceOrmManager, dataSourceService);
  }

  public async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    try {
      const noteTargetRepository =
        await this.globalWorkspaceOrmManager.getRepository<NoteTargetWorkspaceEntity>(
          workspaceId,
          'noteTarget',
        );

      const firestoreRepository =
        new BaseFirestoreRepository<NoteTargetWorkspaceEntity>(
          'noteTargets',
          this.metadataService,
          workspaceId,
          this.firebaseApp,
        );

      const noteTargets = await noteTargetRepository.find();

      if (noteTargets.length === 0) {
        this.logger.log(`No note targets found for workspace ${workspaceId}.`);
        return;
      }

      const transformedNoteTargets = noteTargets.map((noteTarget) => {
        // Map TypeORM entity to a plain object
        return {
          ...noteTarget,
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedNoteTargets.length} note targets for workspace ${workspaceId}.`,
        );
        return;
      }

      this.logger.log(
        `Migrating ${transformedNoteTargets.length} note targets for workspace ${workspaceId}...`,
      );

      // Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (
        let i = 0;
        i < transformedNoteTargets.length;
        i += FIRESTORE_BATCH_LIMIT
      ) {
        const chunk = transformedNoteTargets.slice(
          i,
          i + FIRESTORE_BATCH_LIMIT,
        );
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedNoteTargets.length} note targets for workspace ${workspaceId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to migrate note targets for workspace ${workspaceId}.`,
        error,
      );
      throw error;
    }
  }
}
