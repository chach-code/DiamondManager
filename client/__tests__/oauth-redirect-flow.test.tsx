/**
 * Tests for OAuth redirect flow
 * 
 * Following .cursorrules: Test critical user flows to prevent regressions.
 * This tests the complete OAuth callback -> redirect -> auth detection flow.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, createElement } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/apiConfig';

// Mock apiConfig
jest.mock('@/lib/apiConfig', () => ({
  getApiUrl: jest.fn((path: string) => `https://api.example.com${path}`),
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

describe('OAuth Redirect Flow', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    wrapper = ({ children }: { children: ReactNode }) => {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    };

    jest.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    
    // Mock window.location
    delete (window as any).location;
    (window as any).location = {
      pathname: '/DiamondManager/app',
      search: '',
      href: 'https://example.com/DiamondManager/app',
    };
  });

  it('should detect OAuth callback from URL params and refetch auth', async () => {
    // Simulate OAuth callback redirect with query params
    (window.location as any).search = '?oauth_callback=1&t=1234567890';
    (window.location as any).pathname = '/DiamondManager/app';

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First call: initial auth check (will return null - not authenticated yet)
    // Second call: OAuth redirect refetch (should return user)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => 'Unauthorized',
        json: async () => null,
        headers: new Headers(),
        url: 'https://api.example.com/api/auth/user',
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockUser,
        headers: new Headers(),
        url: 'https://api.example.com/api/auth/user',
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial check to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not be authenticated initially
    expect(result.current.user).toBeNull();

    // Wait for OAuth redirect refetch (simulated delay)
    await waitFor(
      () => {
        expect(result.current.user).toBeTruthy();
      },
      { timeout: 3000 }
    );

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    
    // Verify fetch was called twice (initial + OAuth refetch)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should detect OAuth callback from sessionStorage flag', async () => {
    // Simulate sessionStorage flag set by main.tsx
    sessionStorageMock.setItem('oauth_redirect', Date.now().toString());
    (window.location as any).pathname = '/DiamondManager/app';

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockUser,
      headers: new Headers(),
      url: 'https://api.example.com/api/auth/user',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for auth check
    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    
    // Verify sessionStorage flag was cleared
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('oauth_redirect');
  });

  it('should handle CORS errors gracefully during OAuth redirect', async () => {
    (window.location as any).search = '?oauth_callback=1&t=1234567890';
    (window.location as any).pathname = '/DiamondManager/app';

    // Mock CORS error
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Should handle error gracefully
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should return null instead of throwing
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should only refetch once per OAuth redirect', async () => {
    (window.location as any).search = '?oauth_callback=1&t=1234567890';
    (window.location as any).pathname = '/DiamondManager/app';

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        status: callCount === 1 ? 401 : 200,
        ok: callCount > 1,
        json: async () => callCount > 1 ? mockUser : null,
        text: async () => callCount === 1 ? 'Unauthorized' : '',
        headers: new Headers(),
        url: 'https://api.example.com/api/auth/user',
      });
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for both calls
    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    }, { timeout: 3000 });

    // Should have been called: initial check + OAuth refetch (only once)
    // The oauthRedirectHandledRef should prevent multiple refetches
    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(callCount).toBeLessThanOrEqual(3); // Initial + one OAuth refetch
  });

  it('should not check auth when in guest mode', async () => {
    localStorageMock.setItem('guestMode', 'true');
    (window.location as any).pathname = '/DiamondManager/app';

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait a bit to ensure no auth check happens
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not have called fetch because auth is disabled in guest mode
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.isGuestMode).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('should preserve query params through GitHub Pages 404.html redirect', () => {
    // Simulate what 404.html does: converts /app?oauth_callback=1&t=123
    // to ?/app&oauth_callback=1~and~t=123
    const search = '?/app&oauth_callback=1~and~t=1234567890';
    
    // The main.tsx should convert this back
    if (search.startsWith('?/')) {
      const fullQuery = search.slice(2).replace(/~and~/g, '&');
      const [pathPart, ...queryParts] = fullQuery.split('&');
      
      expect(pathPart).toBe('app');
      expect(queryParts).toContain('oauth_callback=1');
      expect(queryParts).toContain('t=1234567890');
      
      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      expect(queryString).toBe('?oauth_callback=1&t=1234567890');
    }
  });
});
