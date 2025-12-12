import { getBasePath, getBasePathWithSlash, stripBasePath, addBasePath } from '../src/lib/basePath';

// Mock window for node environment
(global as any).window = {
  location: { pathname: '/' }
};

describe('basePath utilities', () => {
  beforeEach(() => {
    // Reset to default
    (global as any).window.location.pathname = '/';
  });

  test('detects DiamondManager base path', () => {
    (global as any).window.location.pathname = '/DiamondManager/foo';
    expect(getBasePath()).toBe('/DiamondManager');
    expect(getBasePathWithSlash()).toBe('/DiamondManager/');
    expect(stripBasePath('/DiamondManager/foo')).toBe('/foo');
    expect(addBasePath('/app')).toBe('/DiamondManager/app');
  });

  test('returns empty base path for root', () => {
    (global as any).window.location.pathname = '/';
    expect(getBasePath()).toBe('');
    expect(getBasePathWithSlash()).toBe('/');
    expect(stripBasePath('/foo')).toBe('/foo');
    expect(addBasePath('/app')).toBe('/app');
  });
});
