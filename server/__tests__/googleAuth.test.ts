/// <reference types="jest" />

console.log('>>> running googleAuth tests');

let getOidcConfig: any;
const mockDiscover = jest.fn();

beforeEach(async () => {
  jest.resetModules();
  mockDiscover.mockReset();
  // Do a module mock before importing the module under test
  // Provide a default FakeIssuer so discovery always resolves to a usable
  // issuer (the function under test discovers the issuer before validating
  // env vars).
  const DefaultIssuer = class {
    static Client = function (opts: any) {
      return {};
    };
  } as any;
  mockDiscover.mockResolvedValue(DefaultIssuer);
  jest.doMock('openid-client', () => ({ Issuer: { discover: mockDiscover } }));
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
    } catch (err: any) {
      console.log('caught error (expected):', err && err.message ? err.message : err);
      expect(String(err)).toMatch(/Missing required env vars/);
    }
  });

  test('returns client when envs present and issuer resolves', async () => {
    process.env.GOOGLE_CLIENT_ID = 'fake-id';
    process.env.GOOGLE_CLIENT_SECRET = 'fake-secret';
    process.env.BACKEND_ORIGIN = 'https://example-backend.test';

    // Mock issuer.discover to return an object with a Client constructor
    const fakeClientInstance = { foo: 'bar' };
    const FakeIssuer = class {
      static Client = function (opts: any) {
        return fakeClientInstance;
      };
    } as any;

    mockDiscover.mockResolvedValue(FakeIssuer);

    try {
      const client = await getOidcConfig();
      expect(client).toBe(fakeClientInstance);
      expect(mockDiscover).toHaveBeenCalledWith('https://accounts.google.com');
    } catch (err) {
      console.log('unexpected error:', err);
      throw err;
    }
  });
});
