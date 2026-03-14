import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import chalk from 'chalk';
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
import { getArrayTransformedField } from 'src/database/utils/migration-transformation.util';

@Command({
  name: 'database:audit-data-migration',
  description: 'Audits data migrated from PostgreSQL to Firestore.',
})
export class AuditDataMigrationCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
  private readonly collectionsToAudit = [
    { name: 'person', firestoreName: 'people' },
    { name: 'company', firestoreName: 'companies' },
    { name: 'note', firestoreName: 'notes' },
    { name: 'task', firestoreName: 'tasks' },
    { name: 'opportunity', firestoreName: 'opportunities' },
    { name: 'user', firestoreName: 'users' },
  ];

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
  }: RunOnWorkspaceArgs): Promise<void> {
    const db = this.firebaseApp.firestore();
    this.logger.log(`Auditing workspace ${workspaceId}...`);

    for (const collection of this.collectionsToAudit) {
      try {
        const repository = await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          collection.name,
        );

        // 1. Count Verification
        const postgresCount = await repository.count();
        const firestoreCountSnapshot = await db
          .collection(collection.firestoreName)
          .where('workspaceId', '==', workspaceId)
          .count()
          .get();
        const firestoreCount = firestoreCountSnapshot.data().count;

        if (postgresCount === firestoreCount) {
          this.logger.log(
            chalk.green(
              `[${collection.name}] Count matches: ${postgresCount} records.`,
            ),
          );
        } else {
          this.logger.log(
            chalk.red(
              `[${collection.name}] Count mismatch: Postgres = ${postgresCount}, Firestore = ${firestoreCount}.`,
            ),
          );
        }

        let schemaValidator;
        try {
          schemaValidator = await this.metadataService.getValidator(
            collection.firestoreName,
            workspaceId,
          );
        } catch (err) {
          this.logger.error(
            `Failed to load validator for ${collection.firestoreName} in workspace ${workspaceId}: ${err.message}`,
          );
        }

        // 2. Data Integrity Sample
        if (postgresCount > 0) {
          const sampleRecords = await repository.find({ take: 100 });

          for (const pgRecord of sampleRecords) {
            const fsDoc = await db
              .collection(collection.firestoreName)
              .doc(pgRecord.id)
              .get();

            if (!fsDoc.exists) {
              this.logger.log(
                chalk.red(
                  `[${collection.name}] Record ${pgRecord.id} missing in Firestore.`,
                ),
              );
              continue;
            }

            const fsData = fsDoc.data();

            if (!fsData) {
              this.logger.log(
                chalk.red(
                  `[${collection.name}] Record ${pgRecord.id} data missing in Firestore.`,
                ),
              );
              continue;
            }

            // Schema Validation
            if (schemaValidator && !schemaValidator.validator(fsData)) {
              this.logger.log(
                chalk.red(
                  `[${collection.name}] Record ${pgRecord.id} failed schema validation: ${JSON.stringify(schemaValidator.validator.errors)}`,
                ),
              );
            }

            if (pgRecord.id !== fsData.id) {
               this.logger.log(
                  chalk.red(
                     `[${collection.name}] Record ${pgRecord.id} mismatch on id. Postgres: ${pgRecord.id}, Firestore: ${fsData.id}`,
                  ),
               );
            }

            if (pgRecord.createdAt?.toISOString() !== fsData.createdAt) {
               this.logger.log(
                  chalk.red(
                     `[${collection.name}] Record ${pgRecord.id} mismatch on createdAt. Postgres: ${pgRecord.createdAt?.toISOString()}, Firestore: ${fsData.createdAt}`,
                  ),
               );
            }

            // Relationship Checks (e.g. companyId on Person, or personId on NoteTarget)
            const relationalFields = ['companyId', 'personId', 'noteId', 'taskId', 'opportunityId', 'workspaceMemberId'];
            for (const field of relationalFields) {
              if (pgRecord[field] && pgRecord[field] !== fsData[field]) {
                this.logger.log(
                  chalk.red(
                    `[${collection.name}] Record ${pgRecord.id} mismatch on relation ${field}. Postgres: ${pgRecord[field]}, Firestore: ${fsData[field]}`,
                  ),
                );
              }
            }

            // Transformed Array field checks
            const arrayFields = ['emails', 'phones', 'links'];
            for (const field of arrayFields) {
               if (pgRecord[field] !== undefined) {
                  const expectedArray = getArrayTransformedField(pgRecord[field]);
                  const stringifiedExpected = JSON.stringify(expectedArray);
                  const stringifiedActual = JSON.stringify(fsData[field] || []);

                  if (stringifiedExpected !== stringifiedActual && !(stringifiedExpected === '[]' && stringifiedActual === 'null')) {
                     this.logger.log(
                        chalk.red(
                           `[${collection.name}] Record ${pgRecord.id} mismatch on array field ${field}. Expected: ${stringifiedExpected}, Actual: ${stringifiedActual}`,
                        ),
                     );
                  }
               }
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to audit collection ${collection.name} for workspace ${workspaceId}.`,
          error,
        );
      }
    }
  }
}
