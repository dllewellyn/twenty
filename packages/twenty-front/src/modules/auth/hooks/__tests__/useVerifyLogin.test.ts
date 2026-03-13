import { renderHook } from '@testing-library/react';

import { useVerifyLogin } from '@/auth/hooks/useVerifyLogin';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';

jest.mock('../useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/users/hooks/useLoadCurrentUser', () => ({
  useLoadCurrentUser: jest.fn(),
}));

describe('useVerifyLogin', () => {
  const mockLoadCurrentUser = jest.fn();
  const mockClearSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useLoadCurrentUser as jest.Mock).mockReturnValue({
      loadCurrentUser: mockLoadCurrentUser,
    });

    (useAuth as jest.Mock).mockReturnValue({
      clearSession: mockClearSession,
    });
  });

  it('should call loadCurrentUser when verifyLoginToken is called', async () => {
    mockLoadCurrentUser.mockResolvedValueOnce({});

    const { result } = renderHook(() => useVerifyLogin());
    await result.current.verifyLoginToken('test-token');

    expect(mockLoadCurrentUser).toHaveBeenCalled();
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it('should call clearSession when loadCurrentUser fails', async () => {
    const error = new Error('Verification failed');
    mockLoadCurrentUser.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useVerifyLogin());
    await result.current.verifyLoginToken('test-token');

    expect(mockLoadCurrentUser).toHaveBeenCalled();
    expect(mockClearSession).toHaveBeenCalled();
  });
});
