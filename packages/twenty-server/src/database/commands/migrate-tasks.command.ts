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
import { TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';

@Command({
  name: 'database:migrate-tasks',
  description: 'Migrates tasks records from PostgreSQL to Firestore.',
})
export class MigrateTasksCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
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
      const taskRepository =
        await this.globalWorkspaceOrmManager.getRepository<TaskWorkspaceEntity>(
          workspaceId,
          'task',
        );

      const firestoreRepository =
        new BaseFirestoreRepository<TaskWorkspaceEntity>(
          'tasks',
          this.metadataService,
          workspaceId,
          this.firebaseApp,
        );

      const tasks = await taskRepository.find();

      if (tasks.length === 0) {
        this.logger.log(`No tasks found for workspace ${workspaceId}.`);
        return;
      }

      const transformedTasks = tasks.map((task) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { searchVector, createdBy, updatedBy, assignee, ...rest } = task;

        // Map TypeORM entity to a plain object
        return {
          ...rest,
          createdBy: { ...createdBy },
          updatedBy: { ...updatedBy },
          ...(assignee ? { assignee: { ...assignee } } : {}),
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedTasks.length} tasks for workspace ${workspaceId}.`,
        );
        return;
      }

      this.logger.log(
        `Migrating ${transformedTasks.length} tasks for workspace ${workspaceId}...`,
      );

      // Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (let i = 0; i < transformedTasks.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = transformedTasks.slice(i, i + FIRESTORE_BATCH_LIMIT);
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedTasks.length} tasks for workspace ${workspaceId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to migrate tasks for workspace ${workspaceId}.`,
        error,
      );
      throw error;
    }
  }
}
