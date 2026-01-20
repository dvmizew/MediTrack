import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminReportsApi } from '$lib/api/client';

// Mock fetch globally
global.fetch = vi.fn();

describe('Admin Reports API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should fetch overview report', async () => {
		const mockData = {
			users: { active: 10, inactive: 2, byRole: [] },
			collaborations: [],
			treatments: { active: 5, inactive: 1, total: 6 },
			doses: { total: 20 },
			adherence: {
				last7Days: { scheduled: 10, confirmed: 8, rate: 0.8 },
				last30Days: { scheduled: 40, confirmed: 35, rate: 0.875 }
			}
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockData
		});

		const result = await adminReportsApi.getOverview();
		expect(result).toEqual(mockData);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('/admin/reports/overview'),
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				})
			})
		);
	});

	it('should fetch user report', async () => {
		const mockData = {
			user: { user_id: 1, email: 'test@example.com', full_name: 'Test User', role: 'pacient', is_active: true },
			stats: { nivel_xp: 100, current_streak: 5, longest_streak: 10, current_badge: 'Bronze' },
			treatments: [],
			confirmations: []
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockData
		});

		const result = await adminReportsApi.getUserReport(1);
		expect(result).toEqual(mockData);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('/admin/reports/user/1'),
			expect.any(Object)
		);
	});

	it('should fetch medic report', async () => {
		const mockData = {
			medic: { user_id: 2, email: 'medic@example.com', full_name: 'Dr. Test', role: 'medic' },
			patients: 15,
			plans: 20,
			messages: 50,
			invites: { accepted: 10, rejected: 2, pending: 3, acceptanceRate: 0.83 }
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockData
		});

		const result = await adminReportsApi.getMedicReport(2);
		expect(result).toEqual(mockData);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('/admin/reports/medic/2'),
			expect.any(Object)
		);
	});

	it('should handle errors gracefully', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({ error: 'Internal Server Error' })
		});

		await expect(adminReportsApi.getOverview()).rejects.toThrow();
	});
});
