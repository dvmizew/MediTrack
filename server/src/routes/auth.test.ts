import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import authRouter from '../../src/routes/auth.js';
import { query } from '../../src/config/database.js';
import bcrypt from 'bcrypt';
import { generateTotpSecret, verifyTotpCode, generateBackupCodes } from '../../src/utils/mfa.js';
import { generateToken } from '../../src/middleware/auth.js';

vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

vi.mock('../../src/config/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, _res: any, next: any) => {
		req.user = { userId: 1, role: 'pacient', email: 'user@test.com' };
		next();
	},
	generateToken: vi.fn(() => 'test-token')
}));

vi.mock('bcrypt', () => ({
	default: {
		hash: vi.fn(async (password: string) => `hashed_${password}`),
		compare: vi.fn(async (password: string) => password === 'correct')
	},
	hash: vi.fn(async (password: string) => `hashed_${password}`),
	compare: vi.fn(async (password: string) => password === 'correct')
}));

vi.mock('../../src/utils/mfa.js', () => ({
	generateTotpSecret: vi.fn(async () => ({ secret: 'SECRETSECRETSECRETSECRET', qrCode: 'qr-code' })),
	verifyTotpCode: vi.fn(() => true),
	generateBackupCodes: vi.fn(() => ['ABCD1234', 'EFGH5678'])
}));

describe('Authentication Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/auth', authRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		(query as any).mockResolvedValue({ rows: [] });
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('POST /auth/register', () => {
		it('should register a new patient', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({
				rows: [{ user_id: 1, email: 'newuser@test.com', full_name: 'Test User', role: 'pacient' }]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/auth/register')
				.send({
					email: 'newuser@test.com',
					password: 'Test123!@',
					fullName: 'Test User',
					role: 'pacient'
				});

			expect(response.status).toBe(201);
			expect(response.body.token).toBe('test-token');
			expect(response.body.user.email).toBe('newuser@test.com');
		});

		it('should reject duplicate email', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ user_id: 1 }] });

			const response = await request(app)
				.post('/auth/register')
				.send({
					email: 'existing@test.com',
					password: 'Test123!@',
					fullName: 'Test User'
				});

			expect(response.status).toBe(400);
			expect(response.body.error).toContain('Email already registered');
		});

		it('should validate required fields', async () => {
			const response = await request(app)
				.post('/auth/register')
				.send({
					email: 'test@test.com',
					password: '123',
					fullName: ''
				});

			expect(response.status).toBe(400);
		});
	});

	describe('POST /auth/login', () => {
		it('should login with valid credentials', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					user_id: 1,
					email: 'user@test.com',
					password_hash: 'hashed_correct',
					full_name: 'User',
					role: 'pacient',
					is_active: true,
					mfa_enabled: false
				}]
			});

			const response = await request(app)
				.post('/auth/login')
				.send({ email: 'user@test.com', password: 'correct' });

			expect(response.status).toBe(200);
			expect(response.body.token).toBe('test-token');
			expect(response.body.user.email).toBe('user@test.com');
		});

		it('should reject invalid credentials', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/auth/login')
				.send({ email: 'notfound@test.com', password: 'wrong' });

			expect(response.status).toBe(401);
			expect(response.body.error).toContain('Invalid credentials');
		});

		it('should reject inactive account', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					user_id: 1,
					email: 'user@test.com',
					password_hash: 'hashed_correct',
					full_name: 'User',
					role: 'pacient',
					is_active: false,
					mfa_enabled: false
				}]
			});

			const response = await request(app)
				.post('/auth/login')
				.send({ email: 'user@test.com', password: 'correct' });

			expect(response.status).toBe(401);
			expect(response.body.error).toContain('inactive');
		});

		it('should require MFA when enabled', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					user_id: 1,
					email: 'user@test.com',
					password_hash: 'hashed_correct',
					full_name: 'User',
					role: 'pacient',
					is_active: true,
					mfa_enabled: true
				}]
			});

			const response = await request(app)
				.post('/auth/login')
				.send({ email: 'user@test.com', password: 'correct' });

			expect(response.status).toBe(200);
			expect(response.body.mfaRequired).toBe(true);
			expect(response.body.userId).toBe(1);
		});
	});

	describe('POST /auth/mfa/setup', () => {
		it('should generate MFA secret and QR', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ cnt: 0 }] });
			(query as any).mockResolvedValueOnce({ rows: [{ mfa_enabled: false, mfa_secret: null }] });

			const response = await request(app)
				.post('/auth/mfa/setup')
				.send({});

			expect(response.status).toBe(200);
			expect(response.body.secret).toBeDefined();
			expect(response.body.qrCode).toBeDefined();
		});
	});

	describe('POST /auth/mfa/verify-setup', () => {
		it('should verify MFA setup and return backup codes', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ cnt: 0 }] });
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/auth/mfa/verify-setup')
				.send({
					secret: 'SECRETSECRETSECRETSECRET',
					totpCode: '123456'
				});

			expect(response.status).toBe(200);
			expect(response.body.message).toContain('MFA enabled');
			expect(response.body.backupCodes).toEqual(['ABCD1234', 'EFGH5678']);
		});
	});

	describe('POST /auth/login-mfa', () => {
		it('should login with valid TOTP code', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ cnt: 0 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{
					user_id: 1,
					email: 'user@test.com',
					full_name: 'User',
					role: 'pacient',
					mfa_secret: 'SECRETSECRETSECRETSECRET',
					mfa_backup_codes: ['ABCD1234'],
					is_active: true
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/auth/login-mfa')
				.send({ userId: 1, totpCode: '123456', rememberDevice: true });

			expect(response.status).toBe(200);
			expect(response.body.token).toBe('test-token');
		});
	});

	describe('POST /auth/mfa/disable', () => {
		it('should disable MFA with valid password', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ password_hash: 'hashed_correct' }] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/auth/mfa/disable')
				.send({ password: 'correct' });

			expect(response.status).toBe(200);
			expect(response.body.message).toContain('MFA disabled');
		});
	});

	describe('POST /auth/mfa/backup-codes', () => {
		it('should generate new backup codes', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ cnt: 0 }] });
			(query as any).mockResolvedValueOnce({ rows: [{ mfa_secret: 'SECRETSECRETSECRETSECRET' }] });
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/auth/mfa/backup-codes')
				.send({ totpCode: '123456' });

			expect(response.status).toBe(200);
			expect(response.body.backupCodes).toEqual(['ABCD1234', 'EFGH5678']);
		});
	});

	describe('POST /auth/refresh-token', () => {
		it('should refresh token for active user', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ user_id: 1, email: 'user@test.com', role: 'pacient', is_active: true }] });

			const response = await request(app)
				.post('/auth/refresh-token')
				.send({});

			expect(response.status).toBe(200);
			expect(response.body.token).toBe('test-token');
		});
	});
});
