import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('API client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockReset();
		// Clear localStorage
		if (typeof window !== 'undefined') {
			localStorage.clear();
		}
	});

	afterEach(() => {
		if (typeof window !== 'undefined') {
			localStorage.clear();
		}
	});

	describe('request function behavior', () => {
		it('should add Authorization header when authenticated', async () => {
			// Set auth token
			authStore.login('test-token-123', {
				id: 1,
				email: 'test@example.com',
				fullName: 'Test User',
				role: 'pacient',
				totalXp: 0,
				currentStreak: 0,
				longestStreak: 0,
				currentBadge: 'bronze'
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true })
			});

			const { api } = await import('$lib/api/client');
			await api.getProfile();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/users/me'),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Bearer test-token-123'
					})
				})
			);
		});

		it('should not add Authorization header for unauthenticated requests', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true })
			});

			const { api } = await import('$lib/api/client');
			await api.login({ email: 'test@example.com', password: 'password' });

			const callArgs = mockFetch.mock.calls[0];
			const headers = callArgs[1].headers;
			expect(headers.Authorization).toBeUndefined();
		});

		it('should add cache-busting parameter for GET requests', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true })
			});

			const { api } = await import('$lib/api/client');
			await api.getProfile();

			const callArgs = mockFetch.mock.calls[0];
			const url = callArgs[0];
			expect(url).toMatch(/ts=\d+/);
		});

		it('should handle 401 unauthorized without logout for protected endpoints', async () => {
			authStore.login('expired-token', {
				id: 1,
				email: 'test@example.com',
				fullName: 'Test User',
				role: 'pacient',
				totalXp: 0,
				currentStreak: 0,
				longestStreak: 0,
				currentBadge: 'bronze'
			});

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ error: 'Unauthorized' })
			});

			const { api } = await import('$lib/api/client');
			
			await expect(api.getProfile()).rejects.toThrow('Unauthorized');
			// Verify user was NOT logged out (has token, non-auth endpoint)
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(true);
			expect(state.token).toBe('expired-token');
		});

		it('should throw error for non-OK responses', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ error: 'Internal Server Error' })
			});

			const { api } = await import('$lib/api/client');
			await expect(api.getProfile()).rejects.toThrow('Internal Server Error');
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network failure'));

			const { api } = await import('$lib/api/client');
			await expect(api.getProfile()).rejects.toThrow('Network failure');
		});
	});

	describe('authentication endpoints', () => {
		it('should call register endpoint', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({ success: true, userId: 1 })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.register({
				email: 'new@example.com',
				password: 'password123',
				fullName: 'New User'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/auth/register'),
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('new@example.com')
				})
			);
			expect(result.success).toBe(true);
		});

		it('should call login endpoint', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ token: 'jwt-token', user: {} })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.login({
				email: 'test@example.com',
				password: 'password123'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/auth/login'),
				expect.objectContaining({
					method: 'POST'
				})
			);
			expect(result.token).toBe('jwt-token');
		});

		it('should call refreshToken endpoint', async () => {
			authStore.login('old-token', {
				id: 1,
				email: 'test@example.com',
				fullName: 'Test User',
				role: 'pacient',
				totalXp: 0,
				currentStreak: 0,
				longestStreak: 0,
				currentBadge: 'bronze'
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ token: 'new-token' })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.refreshToken();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/auth/refresh-token'),
				expect.objectContaining({
					method: 'POST'
				})
			);
			expect(result.token).toBe('new-token');
		});
	});

	describe('user profile endpoints', () => {
		beforeEach(() => {
			authStore.login('test-token', {
				id: 1,
				email: 'test@example.com',
				fullName: 'Test User',
				role: 'pacient',
				totalXp: 0,
				currentStreak: 0,
				longestStreak: 0,
				currentBadge: 'bronze'
			});
		});

		it('should get user profile', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ id: 1, email: 'test@example.com', totalXp: 100 })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.getProfile();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/users/me'),
				expect.any(Object)
			);
			expect(result.id).toBe(1);
		});

		it('should update user profile', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true })
			});

			const { api } = await import('$lib/api/client');
			await api.updateProfile({ fullName: 'Updated Name' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/users/me'),
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('Updated Name')
				})
			);
		});

		it('should update password', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true })
			});

			const { api } = await import('$lib/api/client');
			await api.updatePassword({
				currentPassword: 'old123',
				newPassword: 'new456'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/users/me/password'),
				expect.objectContaining({
					method: 'PATCH'
				})
			);
		});
	});

	describe('collaboration endpoints', () => {
		beforeEach(() => {
			authStore.login('test-token', {
				id: 1,
				email: 'patient@example.com',
				fullName: 'Patient',
				role: 'pacient',
				totalXp: 0,
				currentStreak: 0,
				longestStreak: 0,
				currentBadge: 'bronze'
			});
		});

		it('should send collaboration invite', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({ success: true, inviteId: 1 })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.sendInvite('doctor@example.com');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/collaborations/invite'),
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('doctor@example.com')
				})
			);
			expect(result.success).toBe(true);
		});

		it('should get pending invites', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ invites: [] })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.getPendingInvites();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/collaborations/pending'),
				expect.any(Object)
			);
			expect(result.invites).toBeDefined();
		});

		it('should respond to invite', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ success: true })
			});

			const { api } = await import('$lib/api/client');
			await api.respondToInvite(1, 'accept');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/collaborations/1/respond'),
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('accept')
				})
			);
		});
	});

	describe('treatment endpoints', () => {
		beforeEach(() => {
			authStore.login('test-token', {
				id: 1,
				email: 'doctor@example.com',
				fullName: 'Doctor',
				role: 'medic',
				totalXp: 0,
				currentStreak: 0,
				longestStreak: 0,
				currentBadge: 'bronze'
			});
		});

		it('should create treatment', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({ success: true, treatmentId: 1 })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.createTreatment({
				pacientId: 1,
				diagnosis: 'Diabetes',
				description: 'Treatment plan'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/treatments'),
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('Diabetes')
				})
			);
			expect(result.success).toBe(true);
		});

		it('should get treatments list', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ treatments: [] })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.getTreatments();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/treatments'),
				expect.any(Object)
			);
			expect(result.treatments).toBeDefined();
		});

		it('should get treatment details', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ id: 1, diagnosis: 'Diabetes' })
			});

			const { api } = await import('$lib/api/client');
			const result = await api.getTreatmentDetails(1);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/treatments/1'),
				expect.any(Object)
			);
			expect(result.id).toBe(1);
		});
	});
});
