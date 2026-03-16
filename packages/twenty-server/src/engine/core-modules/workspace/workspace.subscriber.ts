import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceFirestoreRepository } from 'src/engine/core-modules/workspace/repositories/workspace.firestore-repository';
import { Logger } from '@nestjs/common';

@EventSubscriber()
export class WorkspaceSubscriber
  implements EntitySubscriberInterface<WorkspaceEntity>
{
  private readonly logger = new Logger(WorkspaceSubscriber.name);

  constructor(
    private readonly workspaceFirestoreRepository: WorkspaceFirestoreRepository,
  ) {}

  listenTo() {
    return WorkspaceEntity;
  }

  private mapEntityToFirestore(entity: WorkspaceEntity): Partial<WorkspaceEntity> {
    const firestorePayload = { ...entity };

    // Strip relational fields/internal TypeORM state
    delete firestorePayload.logoFile;
    delete firestorePayload.appTokens;
    delete firestorePayload.keyValuePairs;
    delete firestorePayload.workspaceUsers;
    delete firestorePayload.featureFlags;
    delete firestorePayload.approvedAccessDomains;
    delete firestorePayload.emailingDomains;
    delete firestorePayload.publicDomains;
    delete firestorePayload.allPostgresCredentials;
    delete firestorePayload.workspaceSSOIdentityProviders;
    delete firestorePayload.agents;
    delete firestorePayload.webhooks;
    delete firestorePayload.apiKeys;
    delete firestorePayload.views;
    delete firestorePayload.viewFields;
    delete firestorePayload.viewFilters;
    delete firestorePayload.viewFilterGroups;
    delete firestorePayload.viewGroups;
    delete firestorePayload.viewSorts;
    delete firestorePayload.defaultRole;
    delete firestorePayload.workspaceCustomApplication;
    delete firestorePayload.applications;

    return firestorePayload;
  }

  async afterInsert(event: InsertEvent<WorkspaceEntity>) {
    if (!event.entity) return;
    try {
      const payload = this.mapEntityToFirestore(event.entity);
      await this.workspaceFirestoreRepository.save(payload as WorkspaceEntity);
    } catch (error) {
      this.logger.error(
        `[Dual-Write] Failed to sync workspace insert to Firestore for ID ${event.entity.id}`,
        error,
      );
    }
  }

  async afterUpdate(event: UpdateEvent<WorkspaceEntity>) {
    if (!event.entity || !event.databaseEntity) return;

    try {
      const mergedEntity = { ...event.databaseEntity, ...event.entity };
      const payload = this.mapEntityToFirestore(mergedEntity as WorkspaceEntity);

      // Explicitly pass ID to save so it can be merged with existing document if needed
      await this.workspaceFirestoreRepository.save(payload as WorkspaceEntity);
    } catch (error) {
      this.logger.error(
        `[Dual-Write] Failed to sync workspace update to Firestore for ID ${event.entity.id || event.databaseEntity.id}`,
        error,
      );
    }
  }

  async afterRemove(event: RemoveEvent<WorkspaceEntity>) {
    if (!event.entityId) return;
    try {
      await this.workspaceFirestoreRepository.delete(event.entityId);
    } catch (error) {
      this.logger.error(
        `[Dual-Write] Failed to sync workspace deletion to Firestore for ID ${event.entityId}`,
        error,
      );
    }
  }

  async afterSoftRemove(event: SoftRemoveEvent<WorkspaceEntity>) {
    if (!event.entity?.id && !event.databaseEntity?.id) return;
    const id = event.entity?.id || event.databaseEntity?.id;
    if (!id) return;

    try {
      await this.workspaceFirestoreRepository.update(id, {
        deletedAt: new Date().toISOString(),
      } as any);
    } catch (error) {
      this.logger.error(
        `[Dual-Write] Failed to sync workspace soft deletion to Firestore for ID ${id}`,
        error,
      );
    }
  }
}
