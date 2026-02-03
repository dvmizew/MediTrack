import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import dosesRouter from '../../src/routes/doses.js';
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
	},
	authorize: (role: string) => (req: any, res: any, next: any) => {
		if (req.user?.role === role) return next();
		return res.status(403).json({ error: 'Forbidden' });
	}
}));

describe('Treatment Doses Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/doses', dosesRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('POST /doses', () => {
		it('should add dose to plan (medic)', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 2 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{
					dose_id: 1,
					plan_id: 10,
					medication_name: 'Aspirin',
					cantitate: '100mg',
					ora: '08:00',
					frecventa: 'daily',
					start_date: '2026-02-01',
					end_date: null,
					instructiuni: null,
					detalii_medicament: 'Pain reliever',
					is_active: true,
					status: 'pending',
					created_at: '2026-02-01'
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/doses')
				.set('x-test-role', 'medic')
				.send({
					planId: 10,
					medicationName: 'Aspirin',
					cantitate: '100mg',
					ora: '08:00',
					frecventa: 'daily',
					startDate: '2026-02-01',
					detaliiMedicament: 'Pain reliever'
				});

			expect(response.status).toBe(201);
			expect(response.body.doseId).toBe(1);
			expect(response.body.planId).toBe(10);
		});

		it('should return 404 if plan not found', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/doses')
				.set('x-test-role', 'medic')
				.send({
					planId: 10,
					medicationName: 'Aspirin',
					cantitate: '100mg',
					ora: '08:00',
					frecventa: 'daily',
					startDate: '2026-02-01',
					detaliiMedicament: 'Pain reliever'
				});

			expect(response.status).toBe(404);
		});
	});

	describe('GET /doses/plan/:planId', () => {
		it('should get doses for a plan', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ plan_id: 10 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{
					dose_id: 1,
					plan_id: 10,
					medication_name: 'Med1',
					cantitate: '10mg',
					ora: '08:00',
					frecventa: 'daily',
					start_date: '2026-02-01',
					end_date: null,
					instructiuni: null,
					detalii_medicament: 'Details',
					is_active: true,
					status: 'pending',
					created_at: '2026-02-01'
				}]
			});

			const response = await request(app).get('/doses/plan/10');

			expect(response.status).toBe(200);
			expect(Array.isArray(response.body)).toBe(true);
			expect(response.body[0].planId).toBe(10);
		});
	});

	describe('PATCH /doses/:doseId', () => {
		it('should update a dose (medic)', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 2 }] });
			(query as any).mockResolvedValueOnce({
				rows: [{
					dose_id: 1,
					plan_id: 10,
					medication_name: 'Med1',
					cantitate: '10mg',
					ora: '09:00',
					frecventa: 'daily',
					start_date: '2026-02-01',
					end_date: null,
					instructiuni: null,
					detalii_medicament: 'Details',
					is_active: true,
					status: 'pending',
					created_at: '2026-02-01'
				}]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.patch('/doses/1')
				.set('x-test-role', 'medic')
				.send({ ora: '09:00' });

			expect(response.status).toBe(200);
			expect(response.body.time).toBe('09:00');
		});

		it('should reject empty updates', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 2 }] });

			const response = await request(app)
				.patch('/doses/1')
				.set('x-test-role', 'medic')
				.send({});

			expect(response.status).toBe(400);
		});
	});

	describe('DELETE /doses/:doseId', () => {
		it('should delete dose (medic)', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ plan_id: 10, patient_id: 2 }] });
			(query as any).mockResolvedValueOnce({ rows: [{ dose_id: 1, updated_at: '2026-02-03' }] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.delete('/doses/1')
				.set('x-test-role', 'medic');

			expect(response.status).toBe(200);
			expect(response.body.message).toContain('deleted');
		});
	});
});
