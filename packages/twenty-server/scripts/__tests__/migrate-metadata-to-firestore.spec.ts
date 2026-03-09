import { main } from '../migrate-metadata-to-firestore';
import { connectionSource } from '../../src/database/typeorm/core/core.datasource';
import { FieldMetadataType } from 'twenty-shared/types';
import * as admin from 'firebase-admin';

// Mock dependencies
jest.mock('../../src/database/typeorm/core/core.datasource', () => ({
  connectionSource: {
    setOptions: jest.fn(),
    initialize: jest.fn(),
    getRepository: jest.fn(),
    destroy: jest.fn(),
  },
}));

jest.mock('firebase-admin', () => {
  const setMock = jest.fn();
  const docMock = jest.fn().mockReturnValue({ set: setMock });
  const collectionMock = jest.fn().mockReturnValue({ doc: docMock });

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
      collection: collectionMock,
    })),
  };
});

describe('migrate-metadata-to-firestore', () => {
  let objectRepoMock: any;
  let fieldRepoMock: any;
  let firestoreMock: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, FIRESTORE_EMULATOR_HOST: 'localhost:8080' };

    objectRepoMock = {
      find: jest.fn(),
    };
    fieldRepoMock = {
      find: jest.fn(),
    };

    (connectionSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity.name === 'ObjectMetadataEntity') return objectRepoMock;
      if (entity.name === 'FieldMetadataEntity') return fieldRepoMock;
      return {};
    });

    firestoreMock = admin.firestore();
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  it('should successfully migrate a single object to firestore', async () => {
    // Arrange
    objectRepoMock.find.mockResolvedValue([
      {
        workspaceId: 'test-workspace',
        nameSingular: 'testObj',
        namePlural: 'testObjs',
        labelSingular: 'Test Obj',
        labelPlural: 'Test Objs',
        icon: 'test',
        description: 'A test object',
        isSystem: false,
        fields: [
          {
            isActive: true,
            type: FieldMetadataType.TEXT,
            name: 'textField',
            isNullable: false,
          },
          {
            isActive: true,
            type: FieldMetadataType.NUMBER,
            name: 'numberField',
            isNullable: true,
          },
          {
            isActive: true,
            type: FieldMetadataType.EMAILS,
            name: 'emailsField',
            isNullable: true,
          },
          {
            isActive: true,
            type: FieldMetadataType.DATE,
            name: 'dateField',
            isNullable: true,
          },
          {
            isActive: true,
            type: FieldMetadataType.SELECT,
            name: 'selectField',
            isNullable: true,
            options: [
              { label: 'Option 1', value: 'opt1' },
              { label: 'Option 2', value: 'opt2' }
            ]
          },
        ],
      },
    ]);

    // Act
    await main();

    // Assert
    expect(connectionSource.initialize).toHaveBeenCalled();
    expect(objectRepoMock.find).toHaveBeenCalled();

    expect(firestoreMock.collection).toHaveBeenCalledWith('_metadata');
    expect(firestoreMock.collection().doc).toHaveBeenCalledWith('test-workspace_testObj');

    // Ensure json schema looks correct and has correct versioned ID
    const setCallArgs = firestoreMock.collection().doc().set.mock.calls[0][0];
    expect(setCallArgs).toMatchObject({
      nameSingular: 'testObj',
      namePlural: 'testObjs',
      labelSingular: 'Test Obj',
      labelPlural: 'Test Objs',
      icon: 'test',
      description: 'A test object',
      workspaceId: 'test-workspace',
      isSystem: false,
      jsonSchema: {
        $id: 'https://twenty.com/schemas/v1/metadata/test-workspace/testObj',
        type: 'object',
        properties: {
          textField: { type: 'string' },
          numberField: { type: 'number' },
          emailsField: { type: 'object' },
          dateField: { type: 'string', format: 'date' },
          selectField: { type: 'string', enum: ['opt1', 'opt2'] }
        },
        required: ['textField'],
        additionalProperties: true,
      },
    });

    expect(connectionSource.destroy).toHaveBeenCalled();
  });

  it('should handle system objects correctly', async () => {
    // Arrange
    objectRepoMock.find.mockResolvedValue([
      {
        workspaceId: 'some-original-uuid',
        nameSingular: 'sysObj',
        namePlural: 'sysObjs',
        isSystem: true,
        fields: [],
      },
    ]);

    // Act
    await main();

    // Assert
    expect(firestoreMock.collection().doc).toHaveBeenCalledWith('system_sysObj');
    const setCallArgs = firestoreMock.collection().doc().set.mock.calls[0][0];
    expect(setCallArgs.workspaceId).toBe('system');
    expect(setCallArgs.jsonSchema.$id).toBe('https://twenty.com/schemas/v1/metadata/system/sysObj');
  });
});