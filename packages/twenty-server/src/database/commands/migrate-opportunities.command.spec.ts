import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';
import { MigrateOpportunitiesCommand } from './migrate-opportunities.command';

jest.mock('src/engine/twenty-orm/repository/firestore.repository');

describe('MigrateOpportunitiesCommand', () => {
  let command: MigrateOpportunitiesCommand;
  let globalWorkspaceOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;
  let metadataService: jest.Mocked<MetadataService>;

  const mockOpportunityRepository = {
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
      getRepository: jest.fn().mockResolvedValue(mockOpportunityRepository),
    } as any;

    metadataService = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrateOpportunitiesCommand,
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

    command = module.get<MigrateOpportunitiesCommand>(
      MigrateOpportunitiesCommand,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should not migrate if no opportunities are found', async () => {
    mockOpportunityRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'opportunity',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      'No opportunities found for workspace workspace-1.',
    );
  });

  it('should migrate opportunities successfully and strip deprecated/system fields', async () => {
    const mockOpportunities = [
      {
        id: '1',
        name: 'Opportunity 1',
        searchVector: 'foo',
        probability: 'high',
        createdBy: { id: 'u1' },
        updatedBy: { id: 'u2' },
        company: { id: 'c1' },
      },
      {
        id: '2',
        name: 'Opportunity 2',
        searchVector: 'bar',
        probability: 'low',
        createdBy: { id: 'u3' },
        updatedBy: { id: 'u4' },
        pointOfContact: { id: 'p1' },
        owner: { id: 'o1' },
      },
    ];
    mockOpportunityRepository.find.mockResolvedValue(mockOpportunities);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'opportunity',
    );
    expect(mockFirestoreRepository.save).toHaveBeenCalledWith([
      {
        id: '1',
        name: 'Opportunity 1',
        createdBy: { id: 'u1' },
        updatedBy: { id: 'u2' },
        company: { id: 'c1' },
      },
      {
        id: '2',
        name: 'Opportunity 2',
        createdBy: { id: 'u3' },
        updatedBy: { id: 'u4' },
        pointOfContact: { id: 'p1' },
        owner: { id: 'o1' },
      },
    ]);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Migrating 2 opportunities for workspace workspace-1...',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully migrated 2 opportunities for workspace workspace-1.',
    );
  });

  it('should chunk the migrations up correctly according to FIRESTORE_BATCH_LIMIT', async () => {
    const mockOpportunities = Array.from({ length: 1200 }, (_, i) => ({
      id: i.toString(),
      name: `Opportunity ${i}`,
    }));
    mockOpportunityRepository.find.mockResolvedValue(mockOpportunities);

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    const expectedChunks = mockOpportunities.map((opp) => ({
      ...opp,
      createdBy: {},
      updatedBy: {},
    }));

    expect(mockFirestoreRepository.save).toHaveBeenCalledTimes(3);
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      1,
      expectedChunks.slice(0, 500),
    );
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      2,
      expectedChunks.slice(500, 1000),
    );
    expect(mockFirestoreRepository.save).toHaveBeenNthCalledWith(
      3,
      expectedChunks.slice(1000, 1200),
    );
  });

  it('should not save if dryRun is true', async () => {
    const mockOpportunities = [
      { id: '1', name: 'Opportunity 1' },
      { id: '2', name: 'Opportunity 2' },
    ];
    mockOpportunityRepository.find.mockResolvedValue(mockOpportunities);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: { dryRun: true, workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'opportunity',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would migrate 2 opportunities for workspace workspace-1.',
    );
  });
});
