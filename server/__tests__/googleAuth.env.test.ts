import { getCallbackUrlFromEnv } from '../googleAuth';

describe('getCallbackUrlFromEnv', () => {
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;
    delete process.env.BACKEND_ORIGIN;
    delete process.env.APP_ORIGIN;
    delete process.env.PORT;
  });

  test('throws when GOOGLE_CLIENT_ID/SECRET missing', () => {
    expect(() => getCallbackUrlFromEnv()).toThrow(/Missing required env vars/);
  });

  test('returns GOOGLE_CALLBACK_URL when provided', () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_CALLBACK_URL = 'https://example.com/cb';
    expect(getCallbackUrlFromEnv()).toBe('https://example.com/cb');
  });

  test('falls back to BACKEND_ORIGIN when callback not provided', () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.BACKEND_ORIGIN = 'https://backend.test';
    expect(getCallbackUrlFromEnv()).toBe('https://backend.test/api/callback');
  });
});
