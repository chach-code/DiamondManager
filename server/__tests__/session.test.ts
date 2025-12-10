import { getSession } from '../googleAuth';

describe('getSession middleware', () => {
  test('returns a middleware function when using memory store', () => {
    process.env.DEV_USE_MEMORY_STORE = 'true';
    process.env.SESSION_SECRET = 'test-secret';

    const mw = getSession();
    expect(typeof mw).toBe('function');

    // cleanup
    delete process.env.DEV_USE_MEMORY_STORE;
    delete process.env.SESSION_SECRET;
  });
});
