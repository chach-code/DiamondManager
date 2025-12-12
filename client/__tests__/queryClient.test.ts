/**
 * Unit tests for queryClient utilities
 * 
 * Following .cursorrules: Test all functions, utilities, and edge cases.
 */

import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/apiConfig';

// Mock fetch globally
global.fetch = jest.fn();

// Mock apiConfig
jest.mock('@/lib/apiConfig', () => ({
  getApiUrl: jest.fn((path: string) => `https://api.example.com${path}`),
}));

describe('queryClient utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getApiUrl as jest.Mock).mockImplementation((path: string) => `https://api.example.com${path}`);
  });

  describe('getQueryFn', () => {
    it('should return data when request succeeds', async () => {
      const mockData = { id: '1', name: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const queryFn = getQueryFn({ on401: 'returnNull' });
      const result = await queryFn({ queryKey: ['/api/test'] } as any);

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/test',
        { credentials: 'include', cache: 'no-cache' }
      );
    });

    it('should return null when on401 is returnNull and status is 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const queryFn = getQueryFn({ on401: 'returnNull' });
      const result = await queryFn({ queryKey: ['/api/test'] } as any);

      expect(result).toBeNull();
    });

    it('should throw error when on401 is throw and status is 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const queryFn = getQueryFn({ on401: 'throw' });
      
      await expect(queryFn({ queryKey: ['/api/test'] } as any)).rejects.toThrow(
        '401: Unauthorized - authentication required'
      );
    });

    it('should throw error for non-401 error status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server Error',
      });

      const queryFn = getQueryFn({ on401: 'returnNull' });
      
      await expect(queryFn({ queryKey: ['/api/test'] } as any)).rejects.toThrow('500');
    });

    it('should handle network errors (fetch failures)', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const queryFn = getQueryFn({ on401: 'returnNull' });
      
      await expect(queryFn({ queryKey: ['/api/test'] } as any)).rejects.toThrow(
        'Network error: Unable to connect to server'
      );
    });

    it('should join queryKey array to create path', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const queryFn = getQueryFn({ on401: 'returnNull' });
      await queryFn({ queryKey: ['/api', 'teams', '123', 'players'] } as any);

      expect(getApiUrl).toHaveBeenCalledWith('/api/teams/123/players');
    });
  });

  describe('apiRequest', () => {
    it('should make POST request with data', async () => {
      const mockResponse = { id: '1', name: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const response = await apiRequest('POST', '/api/test', { name: 'Test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
          credentials: 'include',
          cache: 'no-cache',
        }
      );
      expect(await response.json()).toEqual(mockResponse);
    });

    it('should make GET request without data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await apiRequest('GET', '/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/test',
        {
          method: 'GET',
          headers: {},
          body: undefined,
          credentials: 'include',
          cache: 'no-cache',
        }
      );
    });

    it('should throw error when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Resource not found',
      });

      await expect(apiRequest('GET', '/api/test')).rejects.toThrow('404');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      await expect(apiRequest('GET', '/api/test')).rejects.toThrow(
        'Network error: Unable to connect to server'
      );
    });
  });
});
