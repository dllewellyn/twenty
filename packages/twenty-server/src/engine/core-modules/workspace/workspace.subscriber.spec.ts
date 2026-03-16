import { Test, type TestingModule } from '@nestjs/testing';
import { WorkspaceSubscriber } from 'src/engine/core-modules/workspace/workspace.subscriber';
import { WorkspaceFirestoreRepository } from 'src/engine/core-modules/workspace/repositories/workspace.firestore-repository';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('WorkspaceSubscriber', () => {
  let subscriber: WorkspaceSubscriber;
  let mockFirestoreRepository: Partial<WorkspaceFirestoreRepository>;

  beforeEach(async () => {
    mockFirestoreRepository = {
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceSubscriber,
        {
          provide: WorkspaceFirestoreRepository,
          useValue: mockFirestoreRepository,
        },
      ],
    }).compile();

    subscriber = module.get<WorkspaceSubscriber>(WorkspaceSubscriber);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(subscriber).toBeDefined();
    expect(subscriber.listenTo()).toBe(WorkspaceEntity);
  });

  it('should dual-write on afterInsert using save()', async () => {
    const mockEntity = { id: 'w1', displayName: 'Test' } as WorkspaceEntity;

    await subscriber.afterInsert({ entity: mockEntity } as any);

    expect(mockFirestoreRepository.save).toHaveBeenCalledWith(mockEntity);
  });

  it('should dual-write on afterUpdate merging entities', async () => {
    const dbEntity = { id: 'w1', displayName: 'Old' };
    const updateEntity = { displayName: 'New' };

    await subscriber.afterUpdate({
      databaseEntity: dbEntity,
      entity: updateEntity,
    } as any);

    expect(mockFirestoreRepository.save).toHaveBeenCalledWith({
      id: 'w1',
      displayName: 'New',
    });
  });

  it('should dual-write on afterRemove', async () => {
    await subscriber.afterRemove({ entityId: 'w1' } as any);
    expect(mockFirestoreRepository.delete).toHaveBeenCalledWith('w1');
  });

  it('should dual-write on afterSoftRemove', async () => {
    await subscriber.afterSoftRemove({ entity: { id: 'w1' } } as any);

    expect(mockFirestoreRepository.update).toHaveBeenCalledWith(
      'w1',
      expect.objectContaining({
        deletedAt: expect.any(String),
      }),
    );
  });
});
