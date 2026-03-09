import { Inject } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import chalk from 'chalk';
import * as admin from 'firebase-admin';
import { Command } from 'nest-commander';
import { DataSource, Repository } from 'typeorm';

import { ActiveOrSuspendedWorkspacesMigrationCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspaces-migration.command-runner';
import { RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspaces-migration.command-runner';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

@Command({
  name: 'database:validate-metadata',
  description:
    'Systematically validates Firestore metadata against Postgres metadata definitions.',
})
export class ValidateMetadataCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
  private readonly db: admin.firestore.Firestore;

  constructor(
    @InjectRepository(WorkspaceEntity)
    protected readonly workspaceRepository: Repository<WorkspaceEntity>,
    protected readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    protected readonly dataSourceService: DataSourceService,
    @Inject(FIREBASE_ADMIN_APP) private readonly firebaseApp: admin.app.App,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super(workspaceRepository, globalWorkspaceOrmManager, dataSourceService);
    this.db = this.firebaseApp
      ? this.firebaseApp.firestore()
      : admin.firestore();
  }

  public async runOnWorkspace({
    workspaceId,
    options: _options,
  }: RunOnWorkspaceArgs): Promise<void> {
    this.logger.log(`Validating metadata for workspace ${workspaceId}...`);

    // 1. Fetch metadata from PostgreSQL
    const objectMetadataRepo =
      await this.globalWorkspaceOrmManager.getRepository<ObjectMetadataEntity>(
        workspaceId,
        'objectMetadata',
      );

    const pgObjects = await objectMetadataRepo.find({
      relations: ['fields'],
    });

    if (pgObjects.length === 0) {
      this.logger.log(
        chalk.yellow(`No Postgres metadata found for workspace ${workspaceId}`),
      );
      return;
    }

    // 2. Fetch metadata from Firestore
    const firestoreObjectsSnapshot = await this.db
      .collection('_metadata')
      .where('workspaceId', 'in', [workspaceId, 'system'])
      .get();

    const firestoreObjects = firestoreObjectsSnapshot.docs.map((doc) =>
      doc.data(),
    );

    // 3. Comparison Logic
    let hasDiscrepancies = false;

    for (const pgObj of pgObjects) {
      const expectedWorkspaceId = pgObj.isSystem ? 'system' : workspaceId;

      const firestoreObj = firestoreObjects.find(
        (fObj) =>
          fObj.namePlural === pgObj.namePlural &&
          fObj.workspaceId === expectedWorkspaceId,
      );

      if (!firestoreObj) {
        this.logger.error(
          chalk.red(
            `[Discrepancy] Object ${pgObj.namePlural} missing in Firestore for workspace ${expectedWorkspaceId}`,
          ),
        );
        hasDiscrepancies = true;
        continue;
      }

      // Check fields
      const jsonSchema = firestoreObj.jsonSchema;
      if (!jsonSchema || !jsonSchema.properties) {
        this.logger.error(
          chalk.red(
            `[Discrepancy] Object ${pgObj.namePlural} in Firestore has missing or invalid jsonSchema`,
          ),
        );
        hasDiscrepancies = true;
        continue;
      }

      const requiredFields = Array.isArray(jsonSchema.required)
        ? jsonSchema.required
        : [];

      const pgFields = pgObj.fields || [];
      const firestoreProperties = Object.keys(jsonSchema.properties || {});

      if (pgFields.length !== firestoreProperties.length) {
        this.logger.error(
          chalk.red(
            `[Discrepancy] Object ${pgObj.namePlural} field count mismatch. ` +
              `Postgres has ${pgFields.length} fields, Firestore has ${firestoreProperties.length} fields.`,
          ),
        );
        hasDiscrepancies = true;
      }

      for (const pgField of pgFields) {
        const firestoreField = jsonSchema.properties[pgField.name];

        if (!firestoreField) {
          this.logger.error(
            chalk.red(
              `[Discrepancy] Field ${pgField.name} missing in Firestore for object ${pgObj.namePlural}`,
            ),
          );
          hasDiscrepancies = true;
          continue;
        }

        // Check required array mapping
        const isPgRequired = pgField.isNullable === false;
        const isFirestoreRequired = requiredFields.includes(pgField.name);

        if (isPgRequired !== isFirestoreRequired) {
          this.logger.error(
            chalk.red(
              `[Discrepancy] Field ${pgObj.namePlural}.${pgField.name} nullable mismatch. ` +
                `PG isNullable: ${pgField.isNullable}, Firestore required array contains: ${isFirestoreRequired}`,
            ),
          );
          hasDiscrepancies = true;
        }

        // Basic type mapping check
        const typeMapping: Record<
          string,
          { type: string; format?: string; items?: any }
        > = {
          ACTOR: { type: 'object' },
          ADDRESS: { type: 'object' },
          ARRAY: { type: 'array' },
          BOOLEAN: { type: 'boolean' },
          CURRENCY: { type: 'object' },
          DATE: { type: 'string', format: 'date' },
          DATE_TIME: { type: 'string', format: 'date-time' },
          EMAILS: { type: 'array', items: { type: 'object' } },
          FILES: { type: 'array', items: { type: 'object' } },
          FULL_NAME: { type: 'object' },
          LINKS: { type: 'array', items: { type: 'object' } },
          MULTI_SELECT: { type: 'array', items: { type: 'string' } },
          NUMBER: { type: 'number' },
          NUMERIC: { type: 'number' },
          PHONES: { type: 'array', items: { type: 'object' } },
          POSITION: { type: 'number' },
          RATING: { type: 'string' },
          RAW_JSON: { type: 'object' },
          RICH_TEXT: { type: 'string' },
          RICH_TEXT_V2: { type: 'object' },
          SELECT: { type: 'string' },
          TEXT: { type: 'string' },
          TS_VECTOR: { type: 'string' },
          UUID: { type: 'string', format: 'uuid' },
          VARCHAR: { type: 'string' }, // Some fallback legacy types
        };

        const expectedType = typeMapping[pgField.type];
        if (expectedType) {
          if (firestoreField.type !== expectedType.type) {
            this.logger.error(
              chalk.red(
                `[Discrepancy] Field ${pgObj.namePlural}.${pgField.name} type mismatch. ` +
                  `Expected ${expectedType.type}, found ${firestoreField.type}`,
              ),
            );
            hasDiscrepancies = true;
          }
          if (
            expectedType.format &&
            firestoreField.format !== expectedType.format
          ) {
            this.logger.error(
              chalk.red(
                `[Discrepancy] Field ${pgObj.namePlural}.${pgField.name} format mismatch. ` +
                  `Expected ${expectedType.format}, found ${firestoreField.format}`,
              ),
            );
            hasDiscrepancies = true;
          }
        } else if (
          pgField.type === 'RELATION' ||
          pgField.type === 'MORPH_RELATION'
        ) {
          // Sensitive Review: Relations should at least exist as a string/UUID or nested structure
          if (
            firestoreField.type !== 'string' &&
            firestoreField.type !== 'object'
          ) {
            this.logger.error(
              chalk.red(
                `[Discrepancy] Field ${pgObj.namePlural}.${pgField.name} relation type mismatch. ` +
                  `Expected string or object, found ${firestoreField.type}`,
              ),
            );
            hasDiscrepancies = true;
          }
        }

        // Check Enum definitions and custom field constraints
        if (pgField.type === 'MULTI_SELECT' || pgField.type === 'SELECT') {
          const pgOptions = (pgField.options as any)?.options || [];
          const firestoreEnum =
            firestoreField.enum || firestoreField.items?.enum;
          if (firestoreEnum) {
            const pgOptionValues = pgOptions.map((opt: any) => opt.value);
            for (const val of pgOptionValues) {
              if (!firestoreEnum.includes(val)) {
                this.logger.error(
                  chalk.red(
                    `[Discrepancy] Field ${pgObj.namePlural}.${pgField.name} enum mismatch. ` +
                      `Option value ${val} missing in Firestore schema enum.`,
                  ),
                );
                hasDiscrepancies = true;
              }
            }
          } else {
            this.logger.error(
              chalk.red(
                `[Discrepancy] Field ${pgObj.namePlural}.${pgField.name} is SELECT/MULTI_SELECT but missing enum in Firestore schema.`,
              ),
            );
            hasDiscrepancies = true;
          }
        }
      }
    }

    if (!hasDiscrepancies) {
      this.logger.log(
        chalk.green(`No discrepancies found for workspace ${workspaceId}.`),
      );
    }
  }
}
