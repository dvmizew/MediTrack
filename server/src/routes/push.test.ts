import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import pushRouter from '../../src/routes/push.js';
import { query } from '../../src/config/database.js';

vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

vi.mock('../../src/config/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../src/config/vapid.js', () => ({
	vapidConfig: { publicKey: 'PUBLIC', privateKey: 'PRIVATE', subject: 'mailto:test@test.com' },
	validateVapidConfig: () => true
}));

vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, _res: any, next: any) => {
		const role = req.header('x-test-role') || 'pacient';
		req.user = { userId: 1, role };
		next();
	}
}));

vi.mock('web-push', () => ({
	default: {
		setVapidDetails: vi.fn(),
		sendNotification: vi.fn(async () => {})
	},
	setVapidDetails: vi.fn(),
	sendNotification: vi.fn(async () => {})
}));

describe('Push Notifications Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/push', pushRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		(query as any).mockResolvedValue({ rows: [] });
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('GET /push/vapid-public-key', () => {
		it('should return public key', async () => {
			const response = await request(app).get('/push/vapid-public-key');
			expect(response.status).toBe(200);
			expect(response.body.publicKey).toBe('PUBLIC');
		});
	});

	describe('POST /push/subscribe', () => {
		it('should save subscription', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/push/subscribe')
				.send({
					subscription: {
						endpoint: 'https://fcm.googleapis.com/1',
						keys: { auth: 'auth', p256dh: 'p256dh' }
					}
				});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});

	describe('POST /push/unsubscribe', () => {
		it('should remove subscription', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/push/unsubscribe')
				.send({ endpoint: 'https://fcm.googleapis.com/1' });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});

	describe('GET /push/status', () => {
		it('should return subscription status', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ endpoint: 'https://fcm.googleapis.com/1', created_at: '2026-02-03' }]
			});

			const response = await request(app).get('/push/status');
			expect(response.status).toBe(200);
			expect(response.body.subscribed).toBe(true);
		});
	});

	describe('POST /push/test', () => {
		it('should send test push (admin)', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ id: 1, endpoint: 'https://fcm.googleapis.com/1', auth: 'auth', p256dh: 'p256dh' }]
			});

			const response = await request(app)
				.post('/push/test')
				.set('x-test-role', 'admin')
				.send({ targetUserId: 1 });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});
});
