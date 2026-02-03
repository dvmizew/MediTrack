import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import usersRouter from '../../src/routes/users.js';
import { query } from '../../src/config/database.js';

// Mock database
vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

// Mock logger
vi.mock('../../src/config/logger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	}
}));

// Mock auth middleware
vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, res: any, next: any) => {
		req.user = { userId: 1, role: 'admin' };
		next();
	},
	authorize: (role: string) => (req: any, res: any, next: any) => {
		if (req.user?.role === role) {
			next();
		} else {
			res.status(403).json({ error: 'Forbidden' });
		}
	}
}));

describe('Users API Endpoints', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/users', usersRouter);
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('GET /users', () => {
		it('should return all users for admin', async () => {
			const mockUsers = [
				{
					user_id: 1,
					email: 'admin@test.com',
					full_name: 'Admin User',
					role: 'admin',
					is_active: true,
					mfa_enabled: false,
					created_at: new Date()
				},
				{
					user_id: 2,
					email: 'user@test.com',
					full_name: 'Test User',
					role: 'pacient',
					is_active: true,
					mfa_enabled: false,
					created_at: new Date()
				}
			];

			(query as any).mockResolvedValueOnce({ rows: mockUsers });

			const response = await request(app)
				.get('/users')
				.expect(200);

			expect(response.body).toHaveLength(2);
			expect(response.body[0]).toHaveProperty('userId');
			expect(response.body[0]).toHaveProperty('email');
			expect(response.body[0]).toHaveProperty('role');
		});

		it('should handle database errors', async () => {
			(query as any).mockRejectedValueOnce(new Error('Database error'));

			await request(app)
				.get('/users')
				.expect(500);
		});
	});

	describe('PATCH /users/:userId/role', () => {
		it('should update user role successfully', async () => {
			const mockUpdatedUser = {
				user_id: 2,
				email: 'user@test.com',
				full_name: 'Test User',
				role: 'medic'
			};

			(query as any).mockResolvedValueOnce({ rows: [mockUpdatedUser] });

			const response = await request(app)
				.patch('/users/2/role')
				.send({ role: 'medic' })
				.expect(200);

			expect(response.body.role).toBe('medic');
			expect(response.body.userId).toBe(2);
		});

		it('should reject invalid role', async () => {
			await request(app)
				.patch('/users/2/role')
				.send({ role: 'invalid_role' })
				.expect(400);
		});

		it('should return 404 for non-existent user', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			await request(app)
				.patch('/users/999/role')
				.send({ role: 'medic' })
				.expect(404);
		});
	});

	describe('PATCH /users/:userId/status', () => {
		it('should toggle user status successfully', async () => {
			const mockUpdatedUser = {
				user_id: 2,
				email: 'user@test.com',
				is_active: false
			};

			(query as any).mockResolvedValueOnce({ rows: [mockUpdatedUser] });

			const response = await request(app)
				.patch('/users/2/status')
				.expect(200);

			expect(response.body.isActive).toBe(false);
			expect(response.body.userId).toBe(2);
		});

		it('should return 404 for non-existent user', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			await request(app)
				.patch('/users/999/status')
				.expect(404);
		});
	});

	describe('GET /users/me', () => {
		it('should return current user profile', async () => {
			const mockUser = {
				user_id: 1,
				email: 'admin@test.com',
				full_name: 'Admin User',
				role: 'admin',

				mfa_enabled: false,
				created_at: new Date(),
				total_xp: 100,
				current_streak: 5,
				longest_streak: 10,
				current_badge: 'Bronze'
			};

			(query as any).mockResolvedValueOnce({ rows: [mockUser] });

			const response = await request(app)
				.get('/users/me')
				.expect(200);

			expect(response.body.userId).toBe(1);
			expect(response.body.email).toBe('admin@test.com');
			expect(response.body.totalXp).toBe(100);
		});

		it('should return 404 if user not found', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			await request(app)
				.get('/users/me')
				.expect(404);
		});
	});

	describe('GET /users/:userId', () => {
		it('should return user profile by ID', async () => {
			const mockUser = {
				user_id: 2,
				email: 'user@test.com',
				full_name: 'Test User',
				role: 'pacient',

				created_at: new Date(),
				total_xp: 50,
				current_streak: 3,
				longest_streak: 7,
				current_badge: 'Newbie'
			};

			(query as any).mockResolvedValueOnce({ rows: [mockUser] });

			const response = await request(app)
				.get('/users/2')
				.expect(200);

			expect(response.body.userId).toBe(2);
			expect(response.body.email).toBe('user@test.com');
		});

		it('should return 404 for non-existent or inactive user', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			await request(app)
				.get('/users/999')
				.expect(404);
		});
	});
});
