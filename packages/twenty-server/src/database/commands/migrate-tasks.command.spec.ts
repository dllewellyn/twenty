import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MigrateTasksCommand } from './migrate-tasks.command';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';

jest.mock('src/engine/twenty-orm/repository/firestore.repository');

describe('MigrateTasksCommand', () => {
  let command: MigrateTasksCommand;
  let globalWorkspaceOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;
  let metadataService: jest.Mocked<MetadataService>;

  const mockTaskRepository = {
    find: jest.fn(),
  };

  const mockFirestoreRepository = {
    save: jest.fn(),
  };

  (BaseFirestoreRepository as jest.Mock).mockImplementation(
    () => mockFirestoreRepository,
  );

  beforeEach(async () => {
    globalWorkspaceOrmManager = {
      getRepository: jest.fn().mockResolvedValue(mockTaskRepository),
    } as any;

    metadataService = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrateTasksCommand,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: globalWorkspaceOrmManager,
        },
        {
          provide: DataSourceService,
          useValue: {},
        },
        {
          provide: MetadataService,
          useValue: metadataService,
        },
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: {},
        },
      ],
    }).compile();

    command = module.get<MigrateTasksCommand>(MigrateTasksCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should not migrate if no tasks are found', async () => {
    mockTaskRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'task',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      'No tasks found for workspace workspace-1.',
    );
  });

  it('should migrate tasks successfully', async () => {
    const mockTasks = [
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
    ];
    mockTaskRepository.find.mockResolvedValue(mockTasks);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'task',
    );
    expect(mockFirestoreRepository.save).toHaveBeenCalledWith(mockTasks);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Migrating 2 tasks for workspace workspace-1...',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully migrated 2 tasks for workspace workspace-1.',
    );
  });

  it('should not save if dryRun is true', async () => {
    const mockTasks = [
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
    ];
    mockTaskRepository.find.mockResolvedValue(mockTasks);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: { dryRun: true, workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'task',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would migrate 2 tasks for workspace workspace-1.',
    );
  });
});
