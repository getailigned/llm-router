import request from 'supertest';
import express from 'express';
import { healthController } from '../src/controllers/healthController';

const app = express();
app.use('/health', healthController);

describe('Health Controller', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('vertexAI');
      expect(response.body.checks).toHaveProperty('config');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('process');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('service');
      expect(response.body.checks).toHaveProperty('system');
      expect(response.body.checks).toHaveProperty('environment');
    });
  });
});
