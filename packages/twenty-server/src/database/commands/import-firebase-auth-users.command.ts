import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Command } from 'nest-commander';
import { Not, IsNull, Repository } from 'typeorm';

import { MigrationCommandRunner } from 'src/database/commands/command-runners/migration.command-runner';
import { FirebaseAdminService } from 'src/engine/core-modules/firebase/firebase-admin.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

@Command({
  name: 'database:import-firebase-auth-users',
  description: 'Imports legacy users from PostgreSQL into Firebase Authentication.',
})
export class ImportFirebaseAuthUsersCommand extends MigrationCommandRunner {
  constructor(
    @InjectRepository(UserEntity, 'core')
    protected readonly userRepository: Repository<UserEntity>,
    protected readonly firebaseAdminService: FirebaseAdminService,
  ) {
    super();
  }

  public async runMigrationCommand(
    _passedParams: string[],
    options: { dryRun?: boolean; verbose?: boolean },
  ): Promise<void> {
    try {
      this.logger.log(`Fetching users with passwords from PostgreSQL...`);
      const users = await this.userRepository.find({
        where: { passwordHash: Not(IsNull()) },
        withDeleted: true,
      });

      if (users.length === 0) {
        this.logger.log(`No users found to import.`);
        return;
      }

      this.logger.log(`Found ${users.length} users with password hashes.`);

      const records: admin.auth.UserImportRecord[] = users.map((user) => ({
        uid: user.id,
        email: user.email,
        passwordHash: Buffer.from(user.passwordHash),
        emailVerified: user.isEmailVerified,
        disabled: user.disabled,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
      }));

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would import ${records.length} users into Firebase Auth.`,
        );
        return;
      }

      this.logger.log(`Importing ${records.length} users into Firebase Auth...`);

      const BATCH_LIMIT = 1000;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < records.length; i += BATCH_LIMIT) {
        const chunk = records.slice(i, i + BATCH_LIMIT);

        try {
          const result = await this.firebaseAdminService.auth.importUsers(
            chunk,
            { hash: { algorithm: 'BCRYPT' } }
          );

          successCount += result.successCount;
          failureCount += result.failureCount;

          if (result.failureCount > 0) {
            result.errors.forEach((err) => {
              this.logger.error(
                `Failed to import user at index ${err.index} in chunk ${i / BATCH_LIMIT}:`,
                err.error,
              );
            });
          }
        } catch (error) {
           this.logger.error(`Failed to import batch starting at index ${i}`, error);
           throw error;
        }
      }

      this.logger.log(`Import complete.`);
      this.logger.log(`Successfully imported: ${successCount}`);
      if (failureCount > 0) {
         this.logger.error(`Failed to import: ${failureCount}`);
      }

    } catch (error) {
      this.logger.error(`Failed to import firebase auth users.`, error);
      throw error;
    }
  }
}
