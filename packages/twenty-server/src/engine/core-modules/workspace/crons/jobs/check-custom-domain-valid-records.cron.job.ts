import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { CustomDomainManagerService } from 'src/engine/core-modules/domain/custom-domain-manager/services/custom-domain-manager.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceFirestoreRepository } from 'src/engine/core-modules/workspace/repositories/workspace.firestore-repository';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

export const CHECK_CUSTOM_DOMAIN_VALID_RECORDS_CRON_PATTERN = '0 * * * *';

@Processor(MessageQueue.cronQueue)
export class CheckCustomDomainValidRecordsCronJob {
  constructor(
    private readonly workspaceRepository: WorkspaceFirestoreRepository,
    private readonly customDomainManagerService: CustomDomainManagerService,
  ) {}

  @Process(CheckCustomDomainValidRecordsCronJob.name)
  @SentryCronMonitor(
    CheckCustomDomainValidRecordsCronJob.name,
    CHECK_CUSTOM_DOMAIN_VALID_RECORDS_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const workspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
        customDomain: { _type: 'not', _value: null },
      },
    });

    const currentHour = new Date().getUTCHours();

    for (const workspace of workspaces) {
      if (!workspace.createdAt) continue;

      const workspaceCreatedAtHour = new Date(workspace.createdAt).getUTCHours();

      if (workspaceCreatedAtHour !== currentHour) continue;

      try {
        await this.customDomainManagerService.checkCustomDomainValidRecords(
          workspace,
        );
      } catch (error) {
        throw new Error(
          `[${CheckCustomDomainValidRecordsCronJob.name}] Cannot check custom domain for workspaces: ${error.message}`,
        );
      }
    }
  }
}
