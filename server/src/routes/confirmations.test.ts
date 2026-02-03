import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import confirmationsRouter from '../../src/routes/confirmations.js';
import { query } from '../../src/config/database.js';

vi.mock('../../src/config/database.js', () => ({
	query: vi.fn()
}));

vi.mock('../../src/config/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../src/config/redis.js', () => ({
	redis: { del: vi.fn() }
}));

vi.mock('../../src/middleware/auth.js', () => ({
	authenticate: (req: any, _res: any, next: any) => {
		req.user = { userId: 1, role: 'pacient' };
		next();
	}
}));

describe('Dose Confirmations Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/confirmations', confirmationsRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		(query as any).mockReset();
		(query as any).mockResolvedValue({ rows: [] });
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('GET /confirmations/today', () => {
		it('should return today doses for patient', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					dose_id: 1,
					plan_id: 2,
					medication_name: 'Aspirin',
					cantitate: '100mg',
					ora: '08:00',
					frecventa: 'daily',
					start_date: '2026-02-01',
					end_date: null,
					instructiuni: null,
					detalii_medicament: 'Details',
					is_active: true,
					status: 'pending',
					confirm_id: null,
					timestamp_confirmare: null,
					rezultat: null,
					snoozed_until: null
				}]
			});

			const response = await request(app).get('/confirmations/today');
			expect(response.status).toBe(200);
			expect(response.body[0].doseId).toBe(1);
		});
	});

	describe('POST /confirmations/confirm', () => {
		it('should confirm dose and update stats', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ patient_id: 1 }] });
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({
				rows: [{ confirm_id: 1, dose_id: 1, scheduled_for: '2026-02-03', timestamp_confirmare: '2026-02-03', rezultat: 'pozitiv', xp_earned: 10, notes: null }]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [{ nivel_xp: 110, current_badge: 'bronze', current_streak: 1, longest_streak: 1 }] });
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/confirmations/confirm')
				.send({ doseId: 1, scheduledFor: '2026-02-03T08:00:00Z' });

			expect(response.status).toBe(200);
			expect(response.body.confirmation.confirmationId).toBe(1);
		});
	});

	describe('POST /confirmations/snooze', () => {
		it('should snooze a dose', async () => {
			(query as any).mockImplementation(async (sql: string) => {
				if (sql.includes('JOIN treatment_plans tp')) {
					return { rows: [{ patient_id: 1 }] };
				}
				if (sql.includes('FROM dose_confirmations')) {
					return { rows: [] };
				}
				if (sql.includes('SELECT ora FROM treatment_doses')) {
					return { rows: [{ ora: '08:00' }] };
				}
				if (sql.includes('INSERT INTO dose_confirmations')) {
					return {
						rows: [{ confirm_id: 1, dose_id: 1, scheduled_for: '2026-02-03', timestamp_confirmare: null, rezultat: 'negativ', snoozed_until: '2026-02-03T09:00:00Z' }]
					};
				}
				return { rows: [] };
			});

			const response = await request(app)
				.post('/confirmations/snooze')
				.send({ doseId: 1, scheduledFor: '2026-02-03T08:00:00Z' });

			expect(response.status).toBe(200);
			expect(response.body.snoozedUntil).toBeDefined();
		});
	});

	describe('GET /confirmations/history', () => {
		it('should return confirmation history', async () => {
				(query as any).mockImplementationOnce(async () => ({
				rows: [{
					confirm_id: 1,
					dose_id: 1,
					scheduled_for: '2026-02-03',
					timestamp_confirmare: '2026-02-03',
					rezultat: 'pozitiv',
					xp_earned: 10,
					notes: null,
					snoozed_until: null,
					medication_name: 'Aspirin',
					cantitate: '100mg',
					ora: '08:00'
				}]
				}));

			const response = await request(app).get('/confirmations/history');
			expect(response.status).toBe(200);
			expect(response.body[0].medicationName).toBe('Aspirin');
		});
	});

	describe('GET /confirmations/history/adherence', () => {
		it('should return adherence history', async () => {
				(query as any).mockImplementationOnce(async () => ({
				rows: [{ date: '2026-02-03', total_doses: '2', taken_doses: '1' }]
				}));

			const response = await request(app).get('/confirmations/history/adherence?days=30');
			expect(response.status).toBe(200);
			expect(response.body[0].adherenceRate).toBe(50);
		});
	});
});
