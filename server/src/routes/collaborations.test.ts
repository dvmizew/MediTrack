import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import collaborationsRouter from '../../src/routes/collaborations.js';
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

describe('Doctor-Patient Collaborations Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/collaborations', collaborationsRouter);
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(() => {
		vi.clearAllMocks();
	});

	describe('POST /collaborations/invite', () => {
		it('should send invite to medic (patient)', async () => {
			(query as any).mockResolvedValueOnce({ rows: [{ user_id: 2, role: 'medic' }] });
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({
				rows: [{ id: 1, patient_id: 1, doctor_id: 2, status_invitatie: 'pending', invited_at: '2026-02-01', responded_at: null }]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/collaborations/invite')
				.set('x-test-role', 'pacient')
				.send({ medicEmail: 'medic@test.com' });

			expect(response.status).toBe(201);
			expect(response.body.statusInvitatie).toBe('pending');
		});

		it('should reject invite if medic not found', async () => {
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.post('/collaborations/invite')
				.set('x-test-role', 'pacient')
				.send({ medicEmail: 'missing@test.com' });

			expect(response.status).toBe(404);
		});
	});

	describe('GET /collaborations/pending', () => {
		it('should list pending invites for medic', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					id: 1,
					patient_id: 1,
					doctor_id: 2,
					status_invitatie: 'pending',
					invited_at: '2026-02-01',
					responded_at: null,
					pacient_email: 'ion@test.com',
					pacient_name: 'Ion'
				}]
			});

			const response = await request(app)
				.get('/collaborations/pending')
				.set('x-test-role', 'medic');

			expect(response.status).toBe(200);
			expect(response.body[0].pacientEmail).toBe('ion@test.com');
		});
	});

	describe('PATCH /collaborations/:inviteId/respond', () => {
		it('should accept invite (medic)', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ id: 1, patient_id: 1, doctor_id: 2, status_invitatie: 'accepted', invited_at: '2026-02-01', responded_at: '2026-02-02' }]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.patch('/collaborations/1/respond')
				.set('x-test-role', 'medic')
				.send({ action: 'accept' });

			expect(response.status).toBe(200);
			expect(response.body.statusInvitatie).toBe('accepted');
		});

		it('should reject invite (medic)', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{ id: 1, patient_id: 1, doctor_id: 2, status_invitatie: 'rejected', invited_at: '2026-02-01', responded_at: '2026-02-02' }]
			});
			(query as any).mockResolvedValueOnce({ rows: [] });

			const response = await request(app)
				.patch('/collaborations/1/respond')
				.set('x-test-role', 'medic')
				.send({ action: 'reject' });

			expect(response.status).toBe(200);
			expect(response.body.statusInvitatie).toBe('rejected');
		});
	});

	describe('GET /collaborations/my', () => {
		it('should list collaborations for patient', async () => {
			(query as any).mockResolvedValueOnce({
				rows: [{
					id: 1,
					patient_id: 1,
					doctor_id: 2,
					status_invitatie: 'accepted',
					invited_at: '2026-02-01',
					responded_at: '2026-02-02',
					medic_email: 'dr@test.com',
					medic_name: 'Dr',
					medic_role: 'medic'
				}]
			});

			const response = await request(app)
				.get('/collaborations/my')
				.set('x-test-role', 'pacient');

			expect(response.status).toBe(200);
			expect(response.body[0].name).toBe('Dr');
		});
	});
});
