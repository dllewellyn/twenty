import { Test, TestingModule } from '@nestjs/testing';
import { ValidateMetadataCommand } from './validate-metadata.command';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';

describe('ValidateMetadataCommand', () => {
  let command: ValidateMetadataCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateMetadataCommand,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: {},
        },
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {},
        },
        {
          provide: DataSourceService,
          useValue: {},
        },
        {
          provide: FIREBASE_ADMIN_APP,
          useValue: {
            firestore: jest.fn(),
          },
        },
        {
          provide: 'Connection',
          useValue: {},
        },
        {
          provide: getDataSourceToken(),
          useValue: {},
        },
      ],
    }).compile();

    command = module.get<ValidateMetadataCommand>(ValidateMetadataCommand);
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });
});
