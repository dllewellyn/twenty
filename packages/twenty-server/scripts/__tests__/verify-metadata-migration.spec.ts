import { main } from '../verify-metadata-migration';
import { connectionSource } from '../../src/database/typeorm/core/core.datasource';
import * as admin from 'firebase-admin';

jest.mock('../../src/database/typeorm/core/core.datasource', () => ({
  connectionSource: {
    setOptions: jest.fn(),
    initialize: jest.fn(),
    getRepository: jest.fn(),
    destroy: jest.fn(),
  },
}));

jest.mock('firebase-admin', () => {
  const mockCollection = jest.fn();
  const mockDoc = jest.fn();
  const mockSet = jest.fn();
  const mockGet = jest.fn();

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
      collection: mockCollection.mockReturnValue({
        doc: mockDoc.mockReturnValue({
          set: mockSet,
        }),
        get: mockGet,
      }),
    })),
  };
});

describe('verify-metadata-migration', () => {
  let mockGetRepository: jest.Mock;
  let mockFirestoreCollection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetRepository = jest.fn();
    (connectionSource.getRepository as jest.Mock).mockImplementation(mockGetRepository);

    mockFirestoreCollection = jest.fn();
    (admin.firestore as jest.Mock).mockImplementation(() => ({
      collection: mockFirestoreCollection,
    }));

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should verify objects correctly', async () => {
    mockGetRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
    });

    const mockGet = jest.fn().mockResolvedValue({
      docs: [],
    });

    mockFirestoreCollection.mockReturnValue({
      get: mockGet,
    });

    await main();

    expect(connectionSource.initialize).toHaveBeenCalled();
    expect(connectionSource.destroy).toHaveBeenCalled();
  });
});
