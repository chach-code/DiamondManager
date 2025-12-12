/**
 * Unit tests for authUtils
 * 
 * Following .cursorrules: Test all functions and edge cases.
 */

import { isUnauthorizedError } from '@/lib/authUtils';

describe('authUtils', () => {
  describe('isUnauthorizedError', () => {
    it('should return true for 401 Unauthorized error', () => {
      const error = new Error('401: Unauthorized - authentication required');
      expect(isUnauthorizedError(error)).toBe(true);
    });

    it('should return true for 401 error with different message format', () => {
      const error = new Error('401: Unauthorized');
      expect(isUnauthorizedError(error)).toBe(true);
    });

    it('should return false for non-401 errors', () => {
      const error = new Error('404: Not Found');
      expect(isUnauthorizedError(error)).toBe(false);
    });

    it('should return false for generic errors', () => {
      const error = new Error('Something went wrong');
      expect(isUnauthorizedError(error)).toBe(false);
    });

    it('should return false for network errors', () => {
      const error = new Error('Network error: Unable to connect to server');
      expect(isUnauthorizedError(error)).toBe(false);
    });
  });
});
