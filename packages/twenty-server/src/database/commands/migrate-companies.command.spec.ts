import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MigrateCompaniesCommand } from './migrate-companies.command';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';

jest.mock('src/engine/twenty-orm/repository/firestore.repository');

describe('MigrateCompaniesCommand', () => {
  let command: MigrateCompaniesCommand;
  let globalWorkspaceOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;
  let metadataService: jest.Mocked<MetadataService>;

  const mockCompanyRepository = {
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
      getRepository: jest.fn().mockResolvedValue(mockCompanyRepository),
    } as any;

    metadataService = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrateCompaniesCommand,
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

    command = module.get<MigrateCompaniesCommand>(MigrateCompaniesCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  it('should not migrate if no companies are found', async () => {
    mockCompanyRepository.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'company',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      'No companies found for workspace workspace-1.',
    );
  });

  it('should migrate companies successfully', async () => {
    const mockCompanies = [
      {
        id: '1',
        name: 'Acme Corp',
        domainName: {
          primaryLinkLabel: 'Acme',
          primaryLinkUrl: 'https://acme.com',
          secondaryLinks: [],
        },
        linkedinLink: null,
        xLink: null,
      },
      {
        id: '2',
        name: 'Initech',
        domainName: null,
        linkedinLink: {
          primaryLinkLabel: 'LinkedIn',
          primaryLinkUrl: 'https://linkedin.com/company/initech',
          secondaryLinks: [
            {
              label: 'Careers',
              url: 'https://linkedin.com/company/initech/careers',
            },
          ],
        },
        xLink: {
          primaryLinkLabel: 'X',
          primaryLinkUrl: 'https://x.com/initech',
          secondaryLinks: null,
        },
      },
    ];
    mockCompanyRepository.find.mockResolvedValue(mockCompanies);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: {},
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'company',
    );
    expect(mockFirestoreRepository.save).toHaveBeenCalledWith([
      {
        id: '1',
        name: 'Acme Corp',
        workspaceId: 'workspace-1',
        domainName: [{ label: 'Acme', url: 'https://acme.com' }],
        linkedinLink: null,
        xLink: null,
      },
      {
        id: '2',
        name: 'Initech',
        workspaceId: 'workspace-1',
        domainName: null,
        linkedinLink: [
          { label: 'LinkedIn', url: 'https://linkedin.com/company/initech' },
          {
            label: 'Careers',
            url: 'https://linkedin.com/company/initech/careers',
          },
        ],
        xLink: [{ label: 'X', url: 'https://x.com/initech' }],
      },
    ]);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Migrating 2 companies for workspace workspace-1...',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      'Successfully migrated 2 companies for workspace workspace-1.',
    );
  });

  it('should not save if dryRun is true', async () => {
    const mockCompanies = [
      {
        id: '1',
        name: 'Acme Corp',
        domainName: null,
        linkedinLink: null,
        xLink: null,
      },
      {
        id: '2',
        name: 'Initech',
        domainName: null,
        linkedinLink: null,
        xLink: null,
      },
    ];
    mockCompanyRepository.find.mockResolvedValue(mockCompanies);
    const loggerSpy = jest.spyOn(command['logger'], 'log');

    await command.runOnWorkspace({
      workspaceId: 'workspace-1',
      options: { dryRun: true, workspaceIds: [] },
      index: 0,
      total: 1,
    });

    expect(globalWorkspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'workspace-1',
      'company',
    );
    expect(mockFirestoreRepository.save).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[DRY RUN] Would migrate 2 companies for workspace workspace-1.',
    );
  });
});
