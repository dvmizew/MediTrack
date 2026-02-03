import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import treatmentsRouter from '../../src/routes/treatments.js';
import { query } from '../../src/config/database.js';
import { randomUUID } from 'crypto';

vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

vi.mock('../../src/config/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('crypto', () => ({
	randomUUID: vi.fn(() => 'token-123')
}));

vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, _res: any, next: any) => {
		const role = req.header('x-test-role') || 'pacient';
		req.user = { userId: 1, role };
		next();
	},
	authorize: (role: string) => (req: any, res: any, next: any) => {
		if (req.user?.role === role) next();
		else res.status(403).json({ error: 'Forbidden' });
	}
}));

describe('Treatment Plans Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/treatments', treatmentsRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('POST /treatments', () => {
		it('should create treatment plan (medic)', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{
					plan_id: 1,
					patient_id: 2,
					doctor_id: 1,
					diagnoza: 'Hypertension',
					descriere: 'Desc',
					activ: true,
					data_creare: '2026-02-01',
					updated_at: '2026-02-01'
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/treatments')
				.set('x-test-role', 'medic')
				.send({ pacientId: 2, diagnosis: 'Hypertension', description: 'Desc' });

			expect(response.status).toBe(201);
			expect(response.body.planId).toBe(1);
		});

		it('should deny creation without collaboration', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/treatments')
				.set('x-test-role', 'medic')
				.send({ pacientId: 2, diagnosis: 'Hypertension' });

			expect(response.status).toBe(403);
		});
	});

	describe('GET /treatments', () => {
		it('should list plans for medic', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					plan_id: 1,
					patient_id: 2,
					doctor_id: 1,
					diagnoza: 'Hypertension',
					descriere: 'Desc',
					activ: true,
					data_creare: '2026-02-01',
					updated_at: '2026-02-01',
					patient_name: 'Ion',
					patient_email: 'ion@test.com'
				}]
			});

			const response = await request(app)
				.get('/treatments')
				.set('x-test-role', 'medic');

			expect(response.status).toBe(200);
			expect(response.body[0].patientName).toBe('Ion');
		});

		it('should list plans for patient', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					plan_id: 1,
					patient_id: 1,
					doctor_id: 2,
					diagnoza: 'Hypertension',
					descriere: 'Desc',
					activ: true,
					data_creare: '2026-02-01',
					updated_at: '2026-02-01',
					doctor_name: 'Dr',
					doctor_email: 'dr@test.com'
				}]
			});

			const response = await request(app)
				.get('/treatments')
				.set('x-test-role', 'pacient');

			expect(response.status).toBe(200);
			expect(response.body[0].doctorName).toBe('Dr');
		});
	});

	describe('GET /treatments/:planId', () => {
		it('should get plan details', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					plan_id: 1,
					patient_id: 1,
					doctor_id: 2,
					diagnoza: 'Hypertension',
					descriere: 'Desc',
					activ: true,
					data_creare: '2026-02-01',
					updated_at: '2026-02-01',
					doctor_name: 'Dr',
					doctor_email: 'dr@test.com',
					patient_name: 'Ion',
					patient_email: 'ion@test.com'
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app).get('/treatments/1');
			expect(response.status).toBe(200);
			expect(response.body.planId).toBe(1);
		});
	});

	describe('PATCH /treatments/:planId', () => {
		it('should update plan (medic)', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 2 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{
					plan_id: 1,
					patient_id: 2,
					doctor_id: 1,
					diagnoza: 'Updated',
					descriere: 'Desc',
					activ: true,
					data_creare: '2026-02-01',
					updated_at: '2026-02-02'
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.patch('/treatments/1')
				.set('x-test-role', 'medic')
				.send({ diagnosis: 'Updated' });

			expect(response.status).toBe(200);
			expect(response.body.diagnoza).toBe('Updated');
		});
	});

	describe('DELETE /treatments/:planId', () => {
		it('should require confirmation token then delete', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 2, is_deleted: false }] });
			const first = await request(app)
				.delete('/treatments/1')
				.set('x-test-role', 'medic');

			expect(first.status).toBe(202);
			expect(first.body.confirmToken).toBe('token-123');

			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 2, is_deleted: false }] });
			(query as any).mockResolvedValueOnce({ rows: [{ plan_id: 1, updated_at: '2026-02-03' }] });
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const second = await request(app)
				.delete('/treatments/1?confirmToken=token-123')
				.set('x-test-role', 'medic');

			expect(second.status).toBe(200);
			expect(second.body.message).toContain('deleted');
		});
	});
});
