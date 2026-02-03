import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import notificationsRouter from '../../src/routes/notifications.js';
import { query } from '../../src/config/database.js';

vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

vi.mock('../../src/config/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, _res: any, next: any) => {
		const role = req.header('x-test-role') || 'pacient';
		req.user = { userId: 1, role };
		next();
	}
}));

describe('Notifications Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/notifications', notificationsRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('GET /notifications', () => {
		it('should fetch notifications with status filter', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					notif_id: 1,
					user_id: 1,
					tip: 'reminder',
					status_notif: 'sent',
					title: 'Reminder',
					message: 'Take meds',
					reference_id: 10,
					created_at: '2026-02-03',
					read_at: null
				}]
			});

			const response = await request(app).get('/notifications?status=sent');
			expect(response.status).toBe(200);
			expect(response.body[0].type).toBe('reminder');
		});
	});

	describe('PATCH /notifications/:notificationId/read', () => {
		it('should mark notification as read', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					notif_id: 1,
					user_id: 1,
					tip: 'alert',
					status_notif: 'read',
					title: 'Alert',
					message: 'Msg',
					reference_id: 1,
					created_at: '2026-02-03',
					read_at: '2026-02-03'
				}]
			});

			const response = await request(app).patch('/notifications/1/read');
			expect(response.status).toBe(200);
			expect(response.body.isRead).toBe(true);
		});
	});

	describe('PATCH /notifications/:notificationId/snooze', () => {
		it('should snooze notification', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ notif_id: 1, user_id: 1, tip: 'reminder', status_notif: 'snoozed', title: 't', message: 'm', reference_id: 1, created_at: '2026-02-03', read_at: null }]
			});

			const response = await request(app).patch('/notifications/1/snooze');
			expect(response.status).toBe(200);
			expect(response.body.status).toBe('snoozed');
		});
	});

	describe('PATCH /notifications/:notificationId/ignore', () => {
		it('should ignore notification', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ notif_id: 1, user_id: 1, tip: 'reminder', status_notif: 'ignored', title: 't', message: 'm', reference_id: 1, created_at: '2026-02-03', read_at: null }]
			});

			const response = await request(app).patch('/notifications/1/ignore');
			expect(response.status).toBe(200);
			expect(response.body.status).toBe('ignored');
		});
	});

	describe('PATCH /notifications/read-all', () => {
		it('should mark all as read', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });
			const response = await request(app).patch('/notifications/read-all');
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});

	describe('DELETE /notifications/:notificationId', () => {
		it('should delete one notification', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ notif_id: 1 }] });
			const response = await request(app).delete('/notifications/1');
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});

	describe('DELETE /notifications', () => {
		it('should delete all notifications', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });
			const response = await request(app).delete('/notifications');
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});

	describe('POST /notifications/send-reminder', () => {
		it('should send reminder to patient', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });
			(query as any).mockResolvedValueOnce({ rows: [{ notif_id: 1, title: 'Memento', message: 'Msg', created_at: '2026-02-03' }] });

			const response = await request(app)
				.post('/notifications/send-reminder')
				.set('x-test-role', 'medic')
				.send({ userId: 2 });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});
	});
});
