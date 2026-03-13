import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MigrateNotesCommand } from './migrate-notes.command';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';

jest.mock('src/engine/twenty-orm/repository/firestore.repository');

describe('MigrateNotesCommand', () => {
  let command: MigrateNotesCommand;
  let globalWorkspaceOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;
  let metadataService: jest.Mocked<MetadataService>;

  const mockNoteRepository = {
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
      getRepository: jest.fn().mockResolvedValue(mockNoteRepository),
    } as any;

    metadataService = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrateNotesCommand,
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

    command = module.get<MigrateNotesCommand>(MigrateNotesCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should not migrate if no notes are found', async () => {
    mockNoteRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'note',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      'No notes found for workspace workspace-1.',
    );
  });

  it('should migrate notes successfully', async () => {
    const mockNotes = [
      { id: '1', title: 'Note 1' },
      { id: '2', title: 'Note 2' },
    ];
    mockNoteRepository.find.mockResolvedValue(mockNotes);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'note',
    );
    const expectedNotes = mockNotes.map((note) => ({
      ...note,
      workspaceId: 'workspace-1',
      createdBy: null,
      updatedBy: null,
    }));
    expect(mockFirestoreRepository.save).toHaveBeenCalledWith(expectedNotes);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Migrating 2 notes for workspace workspace-1...',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully migrated 2 notes for workspace workspace-1.',
    );
  });

  it('should migrate notes in batches of 500', async () => {
    const mockNotes = Array.from({ length: 1200 }, (_, i) => ({
      id: `${i}`,
      title: `Note ${i}`,
    }));
    mockNoteRepository.find.mockResolvedValue(mockNotes);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'note',
    );
    expect(mockFirestoreRepository.save).toHaveBeenCalledTimes(3);
    const expectedNotes = mockNotes.map((note) => ({
      ...note,
      workspaceId: 'workspace-1',
      createdBy: null,
      updatedBy: null,
    }));
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      1,
      expectedNotes.slice(0, 500),
    );
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      2,
      expectedNotes.slice(500, 1000),
    );
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      3,
      expectedNotes.slice(1000, 1200),
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Migrating 1200 notes for workspace workspace-1...',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully migrated 1200 notes for workspace workspace-1.',
    );
  });

  it('should not save if dryRun is true', async () => {
    const mockNotes = [
      { id: '1', title: 'Note 1' },
      { id: '2', title: 'Note 2' },
    ];
    mockNoteRepository.find.mockResolvedValue(mockNotes);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: { dryRun: true, workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'note',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would migrate 2 notes for workspace workspace-1.',
    );
  });
});
