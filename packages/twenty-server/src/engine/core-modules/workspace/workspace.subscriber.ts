import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
  DataSource,
} from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceFirestoreRepository } from 'src/engine/core-modules/workspace/repositories/workspace.firestore-repository';
import { Logger } from '@nestjs/common';

@EventSubscriber()
export class WorkspaceSubscriber
  implements EntitySubscriberInterface<WorkspaceEntity>
{
  private readonly logger = new Logger(WorkspaceSubscriber.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly workspaceFirestoreRepository: WorkspaceFirestoreRepository,
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return WorkspaceEntity;
  }

  private mapEntityToFirestore(entity: WorkspaceEntity): Partial<WorkspaceEntity> {
    const columns = this.dataSource.getMetadata(WorkspaceEntity).columns;
    const payload: Partial<WorkspaceEntity> = {};

    for (const column of columns) {
      if (entity[column.propertyName as keyof WorkspaceEntity] !== undefined) {
        // @ts-expect-error
        payload[column.propertyName as keyof WorkspaceEntity] =
          entity[column.propertyName as keyof WorkspaceEntity];
      }
    }

    return payload;
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
