import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import reportsRouter from '../../src/routes/reports.js';
import { query } from '../../src/config/database.js';
import {
	getUsersByRole,
	getUserStatusCounts,
	getTreatmentStatusCounts,
	getUserInfo,
	getUserTreatments
} from '../../src/utils/queryBuilders.js';

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

vi.mock('../../src/utils/queryBuilders.js', () => ({
	getUsersByRole: vi.fn(),
	getUserStatusCounts: vi.fn(),
	getTreatmentStatusCounts: vi.fn(),
	getUserInfo: vi.fn(),
	getUserTreatments: vi.fn(),
	getUserByRole: vi.fn(),
	getDoctorTreatmentCount: vi.fn(),
	getUserPasswordHash: vi.fn()
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

describe('Admin Reports API Endpoints', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/admin/reports', reportsRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		(query as any).mockResolvedValue({ rows: [] });
		(getUsersByRole as any).mockResolvedValue([]);
		(getUserStatusCounts as any).mockResolvedValue({ active: 0, inactive: 0 });
		(getTreatmentStatusCounts as any).mockResolvedValue({ active: 0, inactive: 0, total: 0 });
		(getUserInfo as any).mockResolvedValue(null);
		(getUserTreatments as any).mockResolvedValue([]);
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('GET /admin/reports/overview', () => {
		it('should return overview metrics', async () => {
			(getUsersByRole as any).mockResolvedValue([
				{ role: 'admin', count: 2 },
				{ role: 'medic', count: 5 },
				{ role: 'pacient', count: 20 }
			]);
			(getUserStatusCounts as any).mockResolvedValue({ active: 25, inactive: 2 });
			(getTreatmentStatusCounts as any).mockResolvedValue({ active: 12, inactive: 3, total: 15 });

			(query as any).mockImplementation(async (sql: string) => {
				if (sql.includes('FROM doctor_patient') && sql.includes('GROUP BY status_invitatie')) {
					return { rows: [{ status: 'accepted', count: 15 }, { status: 'pending', count: 3 }] };
				}
				if (sql.includes('FROM treatment_doses') && sql.includes('COUNT(*)::int AS total')) {
					return { rows: [{ total: 50 }] };
				}
				if (sql.includes('7 days')) {
					return { rows: [{ scheduled: 100, confirmed: 85 }] };
				}
				if (sql.includes('30 days')) {
					return { rows: [{ scheduled: 400, confirmed: 350 }] };
				}
				return { rows: [] };
			});

			const response = await request(app)
				.get('/admin/reports/overview')
				.expect(200);

			expect(response.body).toHaveProperty('users');
			expect(response.body).toHaveProperty('collaborations');
			expect(response.body).toHaveProperty('treatments');
			expect(response.body).toHaveProperty('doses');
			expect(response.body).toHaveProperty('adherence');
			expect(response.body.adherence).toHaveProperty('last7Days');
			expect(response.body.adherence).toHaveProperty('last30Days');
			expect(response.body.adherence.last7Days.rate).toBeCloseTo(0.85, 2);
		});

		it('should handle database errors gracefully', async () => {
			(query as any).mockRejectedValueOnce(new Error('Database connection failed'));

			await request(app)
				.get('/admin/reports/overview')
				.expect(500);
		});
	});

	describe('GET /admin/reports/user/:userId', () => {
		it('should return user report with all details', async () => {
			const mockUser = {
				user_id: 2,
				email: 'patient@test.com',
				full_name: 'Test Patient',
				role: 'pacient',
				is_active: true,
				created_at: new Date()
			};

			const mockStats = {
				nivel_xp: 150,
				current_streak: 7,
				longest_streak: 12,
				current_badge: 'Silver'
			};

			const mockTreatments = [
				{ plan_id: 1, diagnoza: 'Test diagnosis', activ: true, data_creare: new Date() }
			];

			const mockConfirmations = [
				{ rezultat: 'pozitiv', scheduled_for: new Date(), timestamp_confirmare: new Date() }
			];

			(getUserInfo as any).mockResolvedValue(mockUser);
			(getUserTreatments as any).mockResolvedValue(mockTreatments);
			(query as any)
				.mockResolvedValueOnce({ rows: [mockStats] })
				.mockResolvedValueOnce({ rows: mockConfirmations });

			const response = await request(app)
				.get('/admin/reports/user/2')
				.expect(200);

			expect(response.body).toHaveProperty('user');
			expect(response.body).toHaveProperty('stats');
			expect(response.body).toHaveProperty('treatments');
			expect(response.body).toHaveProperty('confirmations');
			expect(response.body.user.user_id).toBe(2);
			expect(response.body.stats.nivel_xp).toBe(150);
		});

		it('should return 404 for non-existent user', async () => {
			(getUserInfo as any).mockResolvedValue(null);

			const response = await request(app)
				.get('/admin/reports/user/999');

			expect(response.status).toBe(200);
			expect(response.body.user).toBeNull();
		});
	});

	describe('GET /admin/reports/medic/:userId', () => {
		it('should return medic workload report', async () => {
			const mockMedic = {
				user_id: 3,
				email: 'medic@test.com',
				full_name: 'Dr. Test',
				role: 'medic'
			};

			(query as any)
				.mockResolvedValueOnce({ rows: [mockMedic] })
				.mockResolvedValueOnce({ rows: [{ patients: 15 }] })
				.mockResolvedValueOnce({ rows: [{ plans: 25 }] })
				.mockResolvedValueOnce({ rows: [{ messages: 120 }] })
				.mockResolvedValueOnce({ rows: [{ accepted: 12, rejected: 2, pending: 1 }] });

			const response = await request(app)
				.get('/admin/reports/medic/3')
				.expect(200);

			expect(response.body).toHaveProperty('medic');
			expect(response.body).toHaveProperty('patients');
			expect(response.body).toHaveProperty('plans');
			expect(response.body).toHaveProperty('messages');
			expect(response.body).toHaveProperty('invites');
			expect(response.body.invites.acceptanceRate).toBeCloseTo(0.86, 2);
		});

		it('should return 404 for non-medic user', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			await request(app)
				.get('/admin/reports/medic/999')
				.expect(404);
		});

		it('should calculate acceptance rate correctly with zero responses', async () => {
			const mockMedic = {
				user_id: 3,
				email: 'newmedic@test.com',
				full_name: 'Dr. New',
				role: 'medic'
			};

			(query as any)
				.mockResolvedValueOnce({ rows: [mockMedic] })
				.mockResolvedValueOnce({ rows: [{ patients: 0 }] })
				.mockResolvedValueOnce({ rows: [{ plans: 0 }] })
				.mockResolvedValueOnce({ rows: [{ messages: 0 }] })
				.mockResolvedValueOnce({ rows: [{ accepted: 0, rejected: 0, pending: 5 }] });

			const response = await request(app)
				.get('/admin/reports/medic/3')
				.expect(200);

			expect(response.body.invites.acceptanceRate).toBe(0);
		});
	});
});
