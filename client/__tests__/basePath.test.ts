import { getBasePath, getBasePathWithSlash, stripBasePath, addBasePath } from '../src/lib/basePath';

describe('basePath utilities', () => {
  const originalWindow = (global as any).window;

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  test('detects DiamondManager base path', () => {
    (global as any).window = { location: { pathname: '/DiamondManager/foo' } };
    expect(getBasePath()).toBe('/DiamondManager');
    expect(getBasePathWithSlash()).toBe('/DiamondManager/');
    expect(stripBasePath('/DiamondManager/foo')).toBe('/foo');
    expect(addBasePath('/app')).toBe('/DiamondManager/app');
  });

  test('returns empty base path for root', () => {
    (global as any).window = { location: { pathname: '/' } };
    expect(getBasePath()).toBe('');
    expect(getBasePathWithSlash()).toBe('/');
    expect(stripBasePath('/foo')).toBe('/foo');
    expect(addBasePath('/app')).toBe('/app');
  });
});
