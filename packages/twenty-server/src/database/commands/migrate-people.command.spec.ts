import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MigratePeopleCommand } from './migrate-people.command';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';

jest.mock('src/engine/twenty-orm/repository/firestore.repository');

describe('MigratePeopleCommand', () => {
  let command: MigratePeopleCommand;
  let globalWorkspaceOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;
  let metadataService: jest.Mocked<MetadataService>;

  const mockPersonRepository = {
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
      getRepository: jest.fn().mockResolvedValue(mockPersonRepository),
    } as any;

    metadataService = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigratePeopleCommand,
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

    command = module.get<MigratePeopleCommand>(MigratePeopleCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should not migrate if no people are found', async () => {
    mockPersonRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'person',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      'No people found for workspace workspace-1.',
    );
  });

  it('should migrate people successfully', async () => {
    const mockPersons = [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Doe' },
    ];
    mockPersonRepository.find.mockResolvedValue(mockPersons);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'person',
    );
    expect(mockFirestoreRepository.save).toHaveBeenCalledWith(mockPersons);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Migrating 2 people for workspace workspace-1...',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully migrated 2 people for workspace workspace-1.',
    );
  });

  it('should not save if dryRun is true', async () => {
    const mockPersons = [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Doe' },
    ];
    mockPersonRepository.find.mockResolvedValue(mockPersons);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: { dryRun: true, workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'person',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would migrate 2 people for workspace workspace-1.',
    );
  });
});
