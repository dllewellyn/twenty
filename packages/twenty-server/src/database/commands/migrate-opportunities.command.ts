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
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';

@Command({
  name: 'database:migrate-opportunities',
  description: 'Migrates opportunities records from PostgreSQL to Firestore.',
})
export class MigrateOpportunitiesCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
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
      const opportunityRepository =
        await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
          workspaceId,
          'opportunity',
        );

      const firestoreRepository =
        new BaseFirestoreRepository<OpportunityWorkspaceEntity>(
          'opportunities',
          this.metadataService,
          workspaceId,
          this.firebaseApp,
        );

      const opportunities = await opportunityRepository.find();

      if (opportunities.length === 0) {
        this.logger.log(`No opportunities found for workspace ${workspaceId}.`);
        return;
      }

      const transformedOpportunities = opportunities.map((opportunity) => {
        // Map TypeORM entity to a plain object
        return {
          ...opportunity,
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedOpportunities.length} opportunities for workspace ${workspaceId}.`,
        );
        return;
      }

      this.logger.log(
        `Migrating ${transformedOpportunities.length} opportunities for workspace ${workspaceId}...`,
      );

      // Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (
        let i = 0;
        i < transformedOpportunities.length;
        i += FIRESTORE_BATCH_LIMIT
      ) {
        const chunk = transformedOpportunities.slice(
          i,
          i + FIRESTORE_BATCH_LIMIT,
        );
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedOpportunities.length} opportunities for workspace ${workspaceId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to migrate opportunities for workspace ${workspaceId}.`,
        error,
      );
      throw error;
    }
  }
}
