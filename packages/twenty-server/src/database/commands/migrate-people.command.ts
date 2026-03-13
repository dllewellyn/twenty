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
import { transformEmailsToFirestore, transformLinksToFirestore, transformPhonesToFirestore } from 'src/database/utils/migration-transformation.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

@Command({
  name: 'database:migrate-people',
  description: 'Migrates people records from PostgreSQL to Firestore.',
})
export class MigratePeopleCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
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
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
        );

      const firestoreRepository =
        new BaseFirestoreRepository<PersonWorkspaceEntity>(
          'people',
          this.metadataService,
          workspaceId,
          this.firebaseApp,
        );

      const persons = await personRepository.find();

      if (persons.length === 0) {
        this.logger.log(`No people found for workspace ${workspaceId}.`);
        return;
      }

      const transformedPersons = persons.map((person) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { searchVector, ...rest } = person;

        // Map TypeORM entity to a plain object
        return {
          ...rest,
          workspaceId,
          emails: transformEmailsToFirestore(person.emails) as any,
          phones: transformPhonesToFirestore(person.phones) as any,
          linkedinLink: transformLinksToFirestore(person.linkedinLink) as any,
          xLink: transformLinksToFirestore(person.xLink) as any,
          // Preserve relational IDs if needed, they are usually on the object
          // For instance, person.companyId
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedPersons.length} people for workspace ${workspaceId}.`,
        );
        return;
      }

      this.logger.log(
        `Migrating ${transformedPersons.length} people for workspace ${workspaceId}...`,
      );

      // Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (
        let i = 0;
        i < transformedPersons.length;
        i += FIRESTORE_BATCH_LIMIT
      ) {
        const chunk = transformedPersons.slice(
          i,
          i + FIRESTORE_BATCH_LIMIT,
        );
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedPersons.length} people for workspace ${workspaceId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to migrate people for workspace ${workspaceId}.`,
        error,
      );
      throw error;
    }
  }
}
