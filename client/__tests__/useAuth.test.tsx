/**
 * Unit tests for useAuth hook
 * 
 * Following .cursorrules: Test all hook behavior including edge cases,
 * error handling, and state transitions.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, createElement } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getQueryFn } from '@/lib/queryClient';

// Mock queryClient module
jest.mock('@/lib/queryClient', () => ({
  getQueryFn: jest.fn(),
  queryClient: new QueryClient(),
}));

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

describe('useAuth', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    wrapper = ({ children }: { children: ReactNode }) => {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    };
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('guest mode initialization', () => {
    it('should initialize guest mode from localStorage', () => {
      localStorageMock.setItem('guestMode', 'true');
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isGuestMode).toBe(true);
    });

    it('should initialize as non-guest when localStorage is empty', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      // Initially false until user check completes
      expect(result.current.isGuestMode).toBe(false);
    });

    it('should handle localStorage errors gracefully (Safari private mode)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = jest.fn((key: string) => {
        throw new Error('localStorage is disabled');
      }) as any;

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isGuestMode).toBe(true); // Should default to true on error
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      localStorageMock.getItem = originalGetItem;
      consoleWarnSpy.mockRestore();
    });
  });

  describe('authentication state', () => {
    it('should return null user when not authenticated', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue(null);
      (getQueryFn as jest.Mock).mockReturnValue(mockQueryFn);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        profileImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQueryFn = jest.fn().mockResolvedValue(mockUser);
      (getQueryFn as jest.Mock).mockReturnValue(mockQueryFn);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isGuestMode).toBe(false);
    });

    it('should clear guest mode when user authenticates', async () => {
      localStorageMock.setItem('guestMode', 'true');
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        profileImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQueryFn = jest.fn().mockResolvedValue(mockUser);
      (getQueryFn as jest.Mock).mockReturnValue(mockQueryFn);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      expect(result.current.isGuestMode).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('guestMode');
    });

    it('should handle localStorage removal errors when clearing guest mode', async () => {
      localStorageMock.setItem('guestMode', 'true');
      const originalRemoveItem = localStorageMock.removeItem;
      localStorageMock.removeItem = jest.fn((key: string) => {
        throw new Error('localStorage write failed');
      }) as any;

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        profileImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQueryFn = jest.fn().mockResolvedValue(mockUser);
      (getQueryFn as jest.Mock).mockReturnValue(mockQueryFn);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      // Should still work even if localStorage removal fails
      expect(result.current.isGuestMode).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      localStorageMock.removeItem = originalRemoveItem;
      consoleWarnSpy.mockRestore();
    });
  });

  describe('setIsGuestMode', () => {
    /**
     * Fixed: setIsGuestMode now persists to localStorage
     */
    it('should persist guest mode to localStorage when set to true', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      act(() => {
        result.current.setIsGuestMode(true);
      });
      
      expect(result.current.isGuestMode).toBe(true);
      // BUG: Currently doesn't persist - localStorage.setItem should be called
      expect(localStorageMock.setItem).toHaveBeenCalledWith('guestMode', 'true');
    });

    /**
     * Fixed: setIsGuestMode now persists to localStorage
     */
    it('should remove guest mode from localStorage when set to false', () => {
      // Set initial guest mode in localStorage
      localStorageMock.setItem('guestMode', 'true');
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Clear localStorage mock calls
      jest.clearAllMocks();
      
      // Clear guest mode
      act(() => {
        result.current.setIsGuestMode(false);
      });
      
      expect(result.current.isGuestMode).toBe(false);
      // BUG: Currently doesn't persist - localStorage.removeItem should be called
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('guestMode');
    });

    it('should persist guest mode across page refreshes', () => {
      const { result, unmount } = renderHook(() => useAuth(), { wrapper });
      
      // Set guest mode
      act(() => {
        result.current.setIsGuestMode(true);
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('guestMode', 'true');
      
      // Unmount (simulate page refresh)
      unmount();
      
      // Re-render hook (simulate page reload)
      const { result: newResult } = renderHook(() => useAuth(), { wrapper });
      
      // Guest mode should be initialized from localStorage
      expect(newResult.current.isGuestMode).toBe(true);
    });
  });

  describe('loading state', () => {
    it('should return isLoading true initially', () => {
      const mockQueryFn = jest.fn(() => new Promise(() => {})); // Never resolves
      (getQueryFn as jest.Mock).mockReturnValue(mockQueryFn);

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isLoading).toBe(true);
    });

    it('should return isLoading false after query completes', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue(null);
      (getQueryFn as jest.Mock).mockReturnValue(mockQueryFn);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
