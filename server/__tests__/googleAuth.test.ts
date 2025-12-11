/// <reference types="jest" />

console.log('>>> running googleAuth tests');

let getOidcConfig: any;
const mockDiscovery = jest.fn();
const mockClientSecretPost = jest.fn();

beforeEach(async () => {
  jest.resetModules();
  mockDiscovery.mockReset();
  mockClientSecretPost.mockReset();
  // Do a module mock before importing the module under test
  // v6 API: Use 'discovery' function instead of 'Issuer.discover'
  // Provide a default Configuration object so discovery always resolves
  const DefaultConfig = {
    issuer: new URL('https://accounts.google.com'),
  };
  mockDiscovery.mockResolvedValue(DefaultConfig);
  mockClientSecretPost.mockReturnValue(() => {}); // Return auth function
  jest.doMock('openid-client', () => ({ 
    discovery: mockDiscovery,
    ClientSecretPost: mockClientSecretPost,
  }));
  const mod = await import('../googleAuth');
  getOidcConfig = mod.getOidcConfig;
});

afterEach(() => {
  jest.resetAllMocks();
  // Clean any env changes
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CALLBACK_URL;
  delete process.env.BACKEND_ORIGIN;
  delete process.env.APP_ORIGIN;
  delete process.env.PORT;
});

describe('googleAuth getOidcConfig', () => {
  test('throws when client id/secret missing', async () => {
    try {
      await getOidcConfig();
      // If we get here, it's a failure
      throw new Error('getOidcConfig did not throw as expected');
    // server/__tests__/googleAuth.test.ts
    } catch (err: any) {
      console.log('caught error (expected):', err && err.message ? err.message : err);
      // FIX: Match the actual error message
      expect(String(err)).toMatch(/Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET/); 
    }
  });

  test('returns config when envs present and discovery resolves', async () => {
    process.env.GOOGLE_CLIENT_ID = 'fake-id';
    process.env.GOOGLE_CLIENT_SECRET = 'fake-secret';
    process.env.BACKEND_ORIGIN = 'https://example-backend.test';

    // Mock discovery to return a Configuration object (v6 API)
    const fakeConfig = { 
      issuer: new URL('https://accounts.google.com'),
      foo: 'bar' 
    };
    mockDiscovery.mockResolvedValue(fakeConfig);

    try {
      const config = await getOidcConfig();
      expect(config).toBe(fakeConfig);
      // v6 API: discovery is called with URL, clientId, clientSecret, ClientSecretPost
      expect(mockDiscovery).toHaveBeenCalledWith(
        expect.any(URL),
        'fake-id',
        'fake-secret',
        expect.any(Function)
      );
      const callUrl = (mockDiscovery.mock.calls[0][0] as URL).href;
      expect(callUrl).toBe('https://accounts.google.com/');
    } catch (err) {
      console.log('unexpected error:', err);
      throw err;
    }
  });
});
