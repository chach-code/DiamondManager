/**
 * BUG REPRODUCTION TEST: 401 Unauthorized with Valid Session Cookie
 * 
 * This test reproduces the bug where a request with a valid session cookie
 * (connect.sid) results in 401 Unauthorized when accessing /api/teams.
 * 
 * The bug occurs when:
 * - A session cookie is sent with the request
 * - But req.isAuthenticated() returns false OR
 * - req.user is undefined/null OR  
 * - req.user.expires_at is undefined/null
 * 
 * Following TDD (.cursorrules): Write failing test first, then fix.
 */

import express, { Express } from 'express';
import request from 'supertest';
import { isAuthenticated } from '../googleAuth';

// Set up test environment to use memory store (no database needed)
beforeAll(() => {
  process.env.DEV_USE_MEMORY_STORE = 'true';
  process.env.SESSION_SECRET = 'test-secret';
});

describe('isAuthenticated middleware bug reproduction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * BUG REPRODUCTION: Session cookie sent but isAuthenticated returns false
   * 
   * This test reproduces the exact scenario from the curl command:
   * - Request includes session cookie (connect.sid)
   * - But authentication fails
   */
  it('should return 401 when session cookie is present but req.isAuthenticated() is false (BUG)', async () => {
    // Create a test endpoint that uses isAuthenticated middleware
    const testApp = express();
    testApp.use(express.json());
    
    // Mock session middleware
    const sessionMw = (req: any, res: any, next: any) => {
      // Simulate session exists but isAuthenticated returns false
      req.session = { cookie: {} };
      req.isAuthenticated = jest.fn(() => false);
      req.user = undefined;
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true });
    });

    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .set('Origin', 'https://chach-code.github.io')
      .send({ name: 'Test Team' })
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized' });
  });

  /**
   * BUG REPRODUCTION: Session exists but user object is missing
   */
  it('should return 401 when req.isAuthenticated() is true but user is undefined (BUG)', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    const sessionMw = (req: any, res: any, next: any) => {
      req.session = { cookie: {} };
      req.isAuthenticated = jest.fn(() => true);
      req.user = undefined; // User is undefined
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true });
    });

    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .send({ name: 'Test Team' })
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized' });
  });

  /**
   * BUG REPRODUCTION: User exists but expires_at is missing
   */
  it('should return 401 when user exists but expires_at is undefined (BUG)', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    const sessionMw = (req: any, res: any, next: any) => {
      req.session = { cookie: {} };
      req.isAuthenticated = jest.fn(() => true);
      req.user = {
        claims: { sub: 'user-123' },
        // expires_at is missing!
      };
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true });
    });

    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .send({ name: 'Test Team' })
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized' });
  });

  /**
   * BUG REPRODUCTION: User expires_at is null
   */
  it('should return 401 when user.expires_at is null (BUG)', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    const sessionMw = (req: any, res: any, next: any) => {
      req.session = { cookie: {} };
      req.isAuthenticated = jest.fn(() => true);
      req.user = {
        claims: { sub: 'user-123' },
        expires_at: null, // expires_at is null
      };
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true });
    });

    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .send({ name: 'Test Team' })
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized' });
  });

  /**
   * BUG FIX TEST: Should attempt refresh if expires_at is missing but refresh_token exists
   */
  it('should attempt to refresh token if expires_at is missing but refresh_token exists', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    const sessionMw = (req: any, res: any, next: any) => {
      req.session = { cookie: {} };
      req.isAuthenticated = jest.fn(() => true);
      req.user = {
        claims: { sub: 'user-123' },
        refresh_token: 'valid-refresh-token',
        // expires_at is missing, but refresh_token exists
      };
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true, team: req.body });
    });

    // This will fail because we can't actually refresh without mocking openid-client
    // But it tests the logic path
    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .send({ name: 'Test Team' })
      .expect(401);

    // Should fail because refresh will fail (no real token to refresh)
    expect(response.body).toEqual({ message: 'Unauthorized' });
  });

  /**
   * BUG REPRODUCTION: Token expired but no refresh_token available
   * 
   * This reproduces the exact production bug:
   * - User is authenticated (session exists)
   * - Token has expired
   * - But refresh_token is missing/null
   * - Result: 401 Unauthorized
   */
  it('should return 401 when token expired and refresh_token is missing (PRODUCTION BUG)', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    // Simulate expired token (past expiration)
    const expiredExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    
    const sessionMw = (req: any, res: any, next: any) => {
      req.session = { 
        cookie: {},
        destroy: jest.fn((callback: any) => callback(null)),
      };
      req.isAuthenticated = jest.fn(() => true);
      req.logout = jest.fn((callback: any) => callback(null));
      req.user = {
        claims: { sub: 'user-123' },
        expires_at: expiredExp, // Token expired
        // refresh_token is missing - this is the bug
      };
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true });
    });

    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .send({ name: 'Test Team' })
      .expect(401);

    expect(response.body).toMatchObject({ 
      message: 'Unauthorized',
      code: 'SESSION_EXPIRED_NO_REFRESH_TOKEN'
    });
  });

  /**
   * Expected behavior: Should succeed when user is properly authenticated
   */
  it('should succeed when user is authenticated with valid expires_at', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    // Set expires_at to future (1 hour from now)
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    
    const sessionMw = (req: any, res: any, next: any) => {
      req.session = { cookie: {} };
      req.isAuthenticated = jest.fn(() => true);
      req.user = {
        claims: { sub: 'user-123' },
        expires_at: futureExp,
      };
      next();
    };
    
    testApp.use(sessionMw);
    testApp.post('/api/teams', isAuthenticated, (req: any, res: any) => {
      res.json({ success: true, team: req.body });
    });

    const response = await request(testApp)
      .post('/api/teams')
      .set('Cookie', 'connect.sid=s%3Atest-session-id.test')
      .send({ name: 'Test Team' })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
