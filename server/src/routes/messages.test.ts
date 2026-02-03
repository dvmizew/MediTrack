import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import messagesRouter from '../../src/routes/messages.js';
import { query } from '../../src/config/database.js';

vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

vi.mock('../../src/config/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../src/config/redis.js', () => ({
	redis: {
		get: vi.fn(),
		del: vi.fn()
	}
}));

vi.mock('../../src/routes/push.js', () => ({
	sendPushToUser: vi.fn(async () => {})
}));

vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, _res: any, next: any) => {
		req.user = { userId: 1, role: 'pacient' };
		next();
	}
}));

describe('Messages Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/messages', messagesRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('POST /messages/send', () => {
		it('should send message when collaboration exists', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{ message_id: 1, sender_id: 1, receiver_id: 2, continut: 'Hello', timestamp_mesaj: '2026-02-03', is_read: false }]
			});
			(query as any).mockResolvedValueOnce({ rows: [{ full_name: 'Dr' }] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/messages/send')
				.send({ receiverId: 2, continut: 'Hello' });

			expect(response.status).toBe(201);
			expect(response.body.message_id).toBe(1);
		});

		it('should reject when no collaboration exists', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/messages/send')
				.send({ receiverId: 2, continut: 'Hello' });

			expect(response.status).toBe(403);
		});
	});

	describe('GET /messages/conversation/:userId', () => {
		it('should get conversation and mark as read', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					message_id: 1,
					sender_id: 1,
					receiver_id: 2,
					continut: 'Hello',
					timestamp_mesaj: '2026-02-03',
					is_read: false,
					sender_name: 'Ion',
					receiver_name: 'Dr'
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app).get('/messages/conversation/2');

			expect(response.status).toBe(200);
			expect(response.body[0].senderName).toBe('Ion');
		});
	});

	describe('GET /messages/conversations', () => {
		it('should list conversations', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					other_user_id: 2,
					other_user_name: 'Dr',
					other_user_role: 'medic',
					last_message: 'Hello',
					last_message_time: '2026-02-03',
					unread_count: 1
				}]
			});

			const response = await request(app).get('/messages/conversations');

			expect(response.status).toBe(200);
			expect(response.body[0].otherUserId).toBe(2);
		});
	});

	describe('PATCH /messages/:messageId/read', () => {
		it('should mark message as read', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ message_id: 1, sender_id: 2, receiver_id: 1, continut: 'Hello', timestamp_mesaj: '2026-02-03', is_read: true }]
			});

			const response = await request(app).patch('/messages/1/read');

			expect(response.status).toBe(200);
			expect(response.body.is_read).toBe(true);
		});
	});

	describe('GET /messages/status/:userId', () => {
		it('should return online status', async () => {
			const { redis } = await import('../../src/config/redis.js');
			(redis.get as any).mockResolvedValueOnce('true');
			(redis.get as any).mockResolvedValueOnce(null);

			const response = await request(app).get('/messages/status/2');

			expect(response.status).toBe(200);
			expect(response.body.online).toBe(true);
		});
	});
});
