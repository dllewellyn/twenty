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
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { transformLinksToFirestore } from 'src/database/utils/migration-transformation.util';

@Command({
  name: 'database:migrate-companies',
  description: 'Migrates companies records from PostgreSQL to Firestore.',
})
export class MigrateCompaniesCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
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
      const companyRepository =
        await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
          workspaceId,
          'company',
        );

      const firestoreRepository =
        new BaseFirestoreRepository<CompanyWorkspaceEntity>(
          'companies',
          this.metadataService,
          workspaceId,
          this.firebaseApp,
        );

      const companies = await companyRepository.find();

      if (companies.length === 0) {
        this.logger.log(`No companies found for workspace ${workspaceId}.`);
        return;
      }

      const transformedCompanies = companies.map((company) => {
        // Map TypeORM entity to a plain object
        return {
          ...company,
          domainName: transformLinksToFirestore(company.domainName) as any,
          linkedinLink: transformLinksToFirestore(company.linkedinLink) as any,
          xLink: transformLinksToFirestore(company.xLink) as any,
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedCompanies.length} companies for workspace ${workspaceId}.`,
        );
        return;
      }

      this.logger.log(
        `Migrating ${transformedCompanies.length} companies for workspace ${workspaceId}...`,
      );

      // Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (let i = 0; i < transformedCompanies.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = transformedCompanies.slice(i, i + FIRESTORE_BATCH_LIMIT);
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedCompanies.length} companies for workspace ${workspaceId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to migrate companies for workspace ${workspaceId}.`,
        error,
      );
      throw error;
    }
  }
}
