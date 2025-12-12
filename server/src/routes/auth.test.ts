import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from './auth.js';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('Auth Integration Tests', () => {
  describe('POST /auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `test${Date.now()}@example.com`,
          password: 'password123',
          fullName: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          fullName: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '12345',
          fullName: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should reject registration with missing fullName', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      email: `logintest${Date.now()}@example.com`,
      password: 'password123',
      fullName: 'Login Test'
    };

    beforeAll(async () => {
      // Create test user
      await request(app)
        .post('/auth/register')
        .send(testUser);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh-token', () => {
    let validToken: string;

    beforeAll(async () => {
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({
          email: `refreshtest${Date.now()}@example.com`,
          password: 'password123',
          fullName: 'Refresh Test'
        });
      validToken = registerResponse.body.token;
    });

    it('should refresh token with valid token', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/auth/refresh-token');

      expect(response.status).toBe(401);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
