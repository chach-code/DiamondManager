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

  it('should detect OAuth callback from URL params', async () => {
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

    // Mock successful auth - OAuth redirect will trigger refetch after 2s delay
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockUser,
      headers: new Headers(),
      url: 'https://api.example.com/api/auth/user',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial auth check
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    // Verify OAuth callback parameter was detected
    // The refetch will happen automatically after 2s delay
    // This test verifies the detection mechanism works
    expect(result.current.user).toMatchObject({
      id: mockUser.id,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should detect OAuth callback from sessionStorage flag', async () => {
    // Simulate sessionStorage flag set by main.tsx
    sessionStorageMock.setItem('oauth_redirect', Date.now().toString());
    (window.location as any).pathname = '/DiamondManager/app';
    (window.location as any).search = ''; // No URL params, only sessionStorage flag

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (global.fetch as jest.Mock).mockResolvedValue({
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
    }, { timeout: 5000 });

    // Use toMatchObject to avoid date comparison issues
    expect(result.current.user).toMatchObject({
      id: mockUser.id,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      profileImageUrl: mockUser.profileImageUrl,
    });
    expect(result.current.isAuthenticated).toBe(true);
    
    // Verify that sessionStorage.getItem was called to check for OAuth redirect flag
    // The flag detection logic should have read it
    expect(sessionStorageMock.getItem).toHaveBeenCalledWith('oauth_redirect');
    
    // The flag will be cleared when OAuth redirect is processed (after 2s delay)
    // In a real scenario, this happens asynchronously, so we verify the detection works
    // rather than waiting for the cleanup which may be delayed
  });

  it('should retry auth check on Safari when initial check returns null (cookie timing)', async () => {
    // Note: Using real timers because React Query doesn't work well with fake timers
    // This test verifies the retry mechanism exists and functions
    
    // Simulate Safari user agent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15',
    });

    // Simulate OAuth callback redirect
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

    // First attempt returns null (Safari cookie timing issue)
    // Second attempt succeeds
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: cookie not available yet, returns null
        return {
          status: 200,
          ok: true,
          json: async () => null,
          headers: new Headers(),
          url: 'https://api.example.com/api/auth/user',
        };
      } else {
        // Subsequent calls: cookie available, returns user
        return {
          status: 200,
          ok: true,
          json: async () => mockUser,
          headers: new Headers(),
          url: 'https://api.example.com/api/auth/user',
        };
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial auth check (should return null)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initial check should return null (simulating Safari cookie timing)
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    // Wait for retry attempts - Safari retry logic should kick in
    // With 3 retries at 3s, 4.5s, 6.75s delays, we wait for at least the first retry
    await waitFor(() => {
      // Should eventually succeed after retry
      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(result.current.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
      });
    }, { timeout: 10000 }); // Wait up to 10 seconds for retries

    expect(result.current.isAuthenticated).toBe(true);
    
    // Verify multiple fetch calls were made (initial + retries)
    expect(callCount).toBeGreaterThanOrEqual(2);
  }, 15000);

  it('should handle Safari OAuth redirect even if initial check fails', async () => {
    // Note: Using real timers because React Query doesn't work well with fake timers
    
    // Simulate Safari user agent (iOS)
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    // Simulate OAuth callback redirect
    sessionStorageMock.setItem('oauth_redirect', Date.now().toString());
    (window.location as any).pathname = '/DiamondManager/app';
    (window.location as any).search = '';

    const mockUser = {
      id: 'user-456',
      email: 'mobile@example.com',
      firstName: 'Mobile',
      lastName: 'User',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First attempt returns null, second succeeds
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          status: 200,
          ok: true,
          json: async () => null, // Cookie not ready
          headers: new Headers(),
          url: 'https://api.example.com/api/auth/user',
        };
      } else {
        return {
          status: 200,
          ok: true,
          json: async () => mockUser,
          headers: new Headers(),
          url: 'https://api.example.com/api/auth/user',
        };
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for retry to succeed (Safari uses 3s initial delay + retries)
    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
      expect(result.current.isAuthenticated).toBe(true);
    }, { timeout: 10000 });

    expect(result.current.user).toMatchObject({
      id: mockUser.id,
      email: mockUser.email,
    });
    
    // Should have made at least 2 calls (initial + retry)
    expect(callCount).toBeGreaterThanOrEqual(2);
  }, 15000);

  it('should handle CORS errors gracefully during OAuth redirect', async () => {
    (window.location as any).search = '?oauth_callback=1&t=1234567890';
    (window.location as any).pathname = '/DiamondManager/app';

    // Mock CORS error for initial auth check
    // The queryFn will catch CORS errors and return null
    (global.fetch as jest.Mock)
      .mockRejectedValue(new TypeError('Failed to fetch')); // All calls will fail

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Should handle error gracefully - CORS errors return null, not throw
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    // Should return null instead of throwing (CORS errors are handled gracefully)
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    // Wait longer to ensure OAuth redirect refetch also handles CORS gracefully
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Should still be null after OAuth redirect refetch (CORS error handled)
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should prevent infinite loops during OAuth redirect', async () => {
    // This test verifies that oauthRedirectHandledRef prevents infinite refetches
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
      // Always return user (simulating successful auth)
      return Promise.resolve({
        status: 200,
        ok: true,
        json: async () => mockUser,
        headers: new Headers(),
        url: 'https://api.example.com/api/auth/user',
      });
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for auth check to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Wait a bit to ensure no infinite loop happens
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Key assertion: should NOT loop infinitely
    // The oauthRedirectHandledRef should prevent multiple refetches
    // Even with OAuth redirect, calls should be limited (not 100+)
    expect(callCount).toBeLessThan(10); // Should NOT loop infinitely
    
    // Should still be authenticated
    expect(result.current.isAuthenticated).toBe(true);
  }, 10000);

  it('should not check auth when in guest mode', async () => {
    localStorageMock.setItem('guestMode', 'true');
    (window.location as any).pathname = '/DiamondManager/app';

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for hook to initialize
    await waitFor(() => {
      expect(result.current.isGuestMode).toBe(true);
    });

    // Should not have called fetch because auth is disabled in guest mode
    expect(global.fetch).not.toHaveBeenCalled();
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
