/// <reference types="jest" />

import request from 'supertest';
import express, { Express } from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import type { Player } from '@shared/schema';

// Mock storage
jest.mock('../storage', () => ({
  storage: {
    getTeamPlayers: jest.fn(),
    createPlayer: jest.fn(),
    updatePlayer: jest.fn(),
    deletePlayer: jest.fn(),
  },
}));

// Mock authentication middleware
jest.mock('../googleAuth', () => {
  const mockAuth = jest.fn((req: any, res: any, next: any) => {
    req.user = {
      claims: {
        sub: 'test-user-id',
      },
    };
    next();
  });
  return {
    setupAuth: jest.fn(async (app: Express) => {
      // Mock auth setup
    }),
    get isAuthenticated() {
      return mockAuth;
    },
  };
});

describe('Players API Routes', () => {
  let app: Express;
  const mockStorage = storage as jest.Mocked<typeof storage>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/teams/:teamId/players', () => {
    it('should return players for a team', async () => {
      const mockPlayers: Player[] = [
        {
          id: 'player-1',
          teamId: 'team-1',
          name: 'John Doe',
          number: '10',
          positions: ['P', '1B'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'player-2',
          teamId: 'team-1',
          name: 'Jane Smith',
          number: '5',
          positions: ['SS'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockStorage.getTeamPlayers.mockResolvedValue(mockPlayers);

      const response = await request(app)
        .get('/api/teams/team-1/players')
        .expect(200);

      // Dates are serialized to strings in JSON
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(mockPlayers.length);
      expect(response.body[0]).toMatchObject({
        id: mockPlayers[0].id,
        name: mockPlayers[0].name,
        number: mockPlayers[0].number,
        positions: mockPlayers[0].positions,
        teamId: mockPlayers[0].teamId,
      });
      expect(mockStorage.getTeamPlayers).toHaveBeenCalledWith('team-1');
    });

    it('should return empty array when team has no players', async () => {
      mockStorage.getTeamPlayers.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/teams/team-1/players')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockStorage.getTeamPlayers.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/teams/team-1/players')
        .expect(500);

      expect(response.body).toEqual({ message: 'Failed to fetch players' });
    });
  });

  describe('POST /api/teams/:teamId/players', () => {
    it('should create a new player', async () => {
      const newPlayer: Player = {
        id: 'player-3',
        teamId: 'team-1',
        name: 'Bob Johnson',
        number: '42',
        positions: ['LF', 'RF'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.createPlayer.mockResolvedValue(newPlayer);

      const response = await request(app)
        .post('/api/teams/team-1/players')
        .send({
          name: 'Bob Johnson',
          number: '42',
          positions: ['LF', 'RF'],
        })
        .expect(201);

      // Dates are serialized to strings in JSON
      expect(response.body).toMatchObject({
        id: newPlayer.id,
        name: newPlayer.name,
        number: newPlayer.number,
        positions: newPlayer.positions,
        teamId: newPlayer.teamId,
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
      expect(mockStorage.createPlayer).toHaveBeenCalledWith({
        name: 'Bob Johnson',
        number: '42',
        positions: ['LF', 'RF'],
        teamId: 'team-1',
      });
    });

    it('should return 400 for invalid player data', async () => {
      const response = await request(app)
        .post('/api/teams/team-1/players')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(mockStorage.createPlayer).not.toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/teams/team-1/players')
        .send({ name: 'Test Player' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should handle database errors', async () => {
      // Reset the mock to ensure it's called
      mockStorage.createPlayer.mockReset();
      mockStorage.createPlayer.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/teams/team-1/players')
        .send({
          name: 'Test Player',
          number: '1',
          positions: [],
        })
        .expect(500);

      expect(response.body).toEqual({ message: 'Failed to create player' });
      expect(mockStorage.createPlayer).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/players/:id', () => {
    it('should update an existing player', async () => {
      const updatedPlayer: Player = {
        id: 'player-1',
        teamId: 'team-1',
        name: 'John Updated',
        number: '10',
        positions: ['P', '1B', '3B'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.updatePlayer.mockResolvedValue(updatedPlayer);

      const response = await request(app)
        .patch('/api/players/player-1')
        .send({ positions: ['P', '1B', '3B'] })
        .expect(200);

      // Dates are serialized to strings in JSON
      expect(response.body).toMatchObject({
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        number: updatedPlayer.number,
        positions: updatedPlayer.positions,
        teamId: updatedPlayer.teamId,
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
      expect(mockStorage.updatePlayer).toHaveBeenCalledWith(
        'player-1',
        { positions: ['P', '1B', '3B'] }
      );
    });

    it('should accept partial update data (zod allows extra fields)', async () => {
      // Note: Zod's .partial() allows extra fields by default (strips them)
      // This test verifies the actual behavior - extra fields are ignored
      const updatedPlayer: Player = {
        id: 'player-1',
        teamId: 'team-1',
        name: 'John Updated',
        number: '10',
        positions: ['P'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.updatePlayer.mockResolvedValue(updatedPlayer);

      const response = await request(app)
        .patch('/api/players/player-1')
        .send({ invalid: 'data', positions: ['P'] })
        .expect(200);

      // The route accepts it because zod partial allows extra fields
      expect(mockStorage.updatePlayer).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({ positions: ['P'] })
      );
    });

    it('should handle database errors', async () => {
      mockStorage.updatePlayer.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .patch('/api/players/player-1')
        .send({ name: 'Updated Name' })
        .expect(500);

      expect(response.body).toEqual({ message: 'Failed to update player' });
    });
  });

  describe('DELETE /api/players/:id', () => {
    it('should delete a player', async () => {
      mockStorage.deletePlayer.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/players/player-1')
        .expect(204);

      expect(mockStorage.deletePlayer).toHaveBeenCalledWith('player-1');
    });

    it('should handle database errors', async () => {
      mockStorage.deletePlayer.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/players/player-1')
        .expect(500);

      expect(response.body).toEqual({ message: 'Failed to delete player' });
    });
  });
});