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
import { NoteWorkspaceEntity } from 'src/modules/note/standard-objects/note.workspace-entity';

@Command({
  name: 'database:migrate-notes',
  description: 'Migrates notes records from PostgreSQL to Firestore.',
})
export class MigrateNotesCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
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
      const noteRepository =
        await this.globalWorkspaceOrmManager.getRepository<NoteWorkspaceEntity>(
          workspaceId,
          'note',
        );

      const firestoreRepository =
        new BaseFirestoreRepository<NoteWorkspaceEntity>(
          'notes',
          this.metadataService,
          workspaceId,
          this.firebaseApp,
        );

      const notes = await noteRepository.find();

      if (notes.length === 0) {
        this.logger.log(`No notes found for workspace ${workspaceId}.`);
        return;
      }

      const transformedNotes = notes.map((note) => {
        // Map TypeORM entity to a plain object
        return {
          ...note,
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedNotes.length} notes for workspace ${workspaceId}.`,
        );
        return;
      }

      this.logger.log(
        `Migrating ${transformedNotes.length} notes for workspace ${workspaceId}...`,
      );

      // Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (let i = 0; i < transformedNotes.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = transformedNotes.slice(i, i + FIRESTORE_BATCH_LIMIT);
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedNotes.length} notes for workspace ${workspaceId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to migrate notes for workspace ${workspaceId}.`,
        error,
      );
      throw error;
    }
  }
}
