import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page as pageStore } from 'vitest/browser';

// Mock dependencies
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/stores', () => ({
	page: {
		subscribe: (fn: any) => {
			fn({ params: { userId: '123' } });
			return () => {};
		}
	}
}));

vi.mock('$lib/stores/auth', () => ({
	authStore: {
		subscribe: (fn: any) => {
			fn({ user: { role: 'admin', id: 1 }, token: 'test-token', isAuthenticated: true });
			return () => {};
		}
	}
}));

vi.mock('$lib/api/client', () => ({
	api: {
		getUsers: vi.fn().mockResolvedValue([
			{ id: 1, email: 'admin@test.com', fullName: 'Admin', role: 'admin', isActive: true },
			{ id: 2, email: 'user@test.com', fullName: 'User', role: 'pacient', isActive: true }
		]),
		updateUserRole: vi.fn().mockResolvedValue({}),
		toggleUserStatus: vi.fn().mockResolvedValue({})
	},
	adminReportsApi: {
		getOverview: vi.fn().mockResolvedValue({
			users: { active: 10, inactive: 2, byRole: [{ role: 'admin', count: 2 }, { role: 'medic', count: 3 }] },
			collaborations: [{ status: 'accepted', count: 5 }],
			treatments: { active: 8, inactive: 2, total: 10 },
			doses: { total: 25 },
			adherence: {
				last7Days: { scheduled: 20, confirmed: 18, rate: 0.9 },
				last30Days: { scheduled: 80, confirmed: 70, rate: 0.875 }
			}
		}),
		getUserReport: vi.fn().mockResolvedValue({
			user: { user_id: 123, email: 'test@test.com', full_name: 'Test User', role: 'pacient', is_active: true, created_at: '2024-01-01' },
			stats: { nivel_xp: 100, current_streak: 5, longest_streak: 10, current_badge: 'Bronze' },
			treatments: [],
			confirmations: []
		}),
		getMedicReport: vi.fn().mockResolvedValue({
			medic: { user_id: 123, email: 'medic@test.com', full_name: 'Dr. Test', role: 'medic' },
			patients: 10,
			plans: 15,
			messages: 50,
			invites: { accepted: 8, rejected: 2, pending: 1, acceptanceRate: 0.8 }
		})
	}
}));

describe('Admin Users Page', () => {
	it('should display users list', async () => {
		const AdminUsersPage = await import('../../../src/routes/admin/users/+page.svelte');
		render(AdminUsersPage.default as any);

		const heading = pageStore.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent(/gestionare utilizatori/i);
	});

	it('should filter users by search query', async () => {
		const AdminUsersPage = await import('../../../src/routes/admin/users/+page.svelte');
		render(AdminUsersPage.default as any);

		const searchInput = pageStore.getByPlaceholder(/nume sau email/i);
		await expect.element(searchInput).toBeInTheDocument();
	});
});

describe('Admin Reports Overview Page', () => {
	it('should display overview statistics', async () => {
		const ReportsOverviewPage = await import('../../../src/routes/admin/reports/+page.svelte');
		render(ReportsOverviewPage.default as any);

		const heading = pageStore.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent(/rapoarte admin/i);
	});

	it('should show loading state initially', async () => {
		const ReportsOverviewPage = await import('../../../src/routes/admin/reports/+page.svelte');
		const { container } = render(ReportsOverviewPage.default as any);

		// Loading spinner should appear
		const spinner = container.querySelector('.animate-spin');
		expect(spinner).toBeTruthy();
	});
});

describe('Admin User Report Page', () => {
	it('should display user report details', async () => {
		const UserReportPage = await import('../../../src/routes/admin/reports/user/[userId]/+page.svelte');
		render(UserReportPage.default as any);

		const heading = pageStore.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent(/raport utilizator/i);
	});
});

describe('Admin Medic Report Page', () => {
	it('should display medic report details', async () => {
		const MedicReportPage = await import('../../../src/routes/admin/reports/medic/[userId]/+page.svelte');
		render(MedicReportPage.default as any);

		const heading = pageStore.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent(/raport medic/i);
	});
});

describe('Admin Access Guards', () => {
	it('should redirect non-admin users from reports overview', async () => {
		const { goto } = await import('$app/navigation');
		
		// Mock non-admin user
		vi.mocked(vi.mocked(require('$lib/stores/auth')).authStore.subscribe).mockImplementation((fn: any) => {
			fn({ user: { role: 'pacient', id: 2 }, token: 'test-token', isAuthenticated: true });
			return () => {};
		});

		const ReportsOverviewPage = await import('../../../src/routes/admin/reports/+page.svelte');
		render(ReportsOverviewPage.default as any);

		expect(goto).toHaveBeenCalledWith('/dashboard');
	});

	it('should redirect non-admin users from user report', async () => {
		const { goto } = await import('$app/navigation');
		
		vi.mocked(vi.mocked(require('$lib/stores/auth')).authStore.subscribe).mockImplementation((fn: any) => {
			fn({ user: { role: 'medic', id: 3 }, token: 'test-token', isAuthenticated: true });
			return () => {};
		});

		const UserReportPage = await import('../../../src/routes/admin/reports/user/[userId]/+page.svelte');
		render(UserReportPage.default as any);

		expect(goto).toHaveBeenCalledWith('/dashboard');
	});
});
