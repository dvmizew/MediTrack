import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth';
import type { User } from '$lib/stores/auth';

describe('Auth Store', () => {
	const mockUser: User = {
		id: 1,
		email: 'test@example.com',
		fullName: 'Test User',
		role: 'pacient',
		totalXp: 100,
		currentStreak: 5,
		longestStreak: 10,
		currentBadge: 'bronze'
	};

	beforeEach(() => {
		localStorage.clear();
	});

	describe('Initial State', () => {
		it('should initialize with unauthenticated state', () => {
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(false);
			expect(state.user).toBeNull();
			expect(state.token).toBeNull();
		});
	});

	describe('Login', () => {
		it('should set user and token on login', () => {
			authStore.login('test-token-123', mockUser);
			
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(true);
			expect(state.token).toBe('test-token-123');
			expect(state.user).toEqual(mockUser);
		});

		it('should update store with different user roles', () => {
			const medicUser: User = { ...mockUser, role: 'medic' };
			authStore.login('medic-token', medicUser);
			
			const state = get(authStore);
			expect(state.user?.role).toBe('medic');
		});
	});

	describe('Logout', () => {
		beforeEach(() => {
			authStore.login('test-token', mockUser);
		});

		it('should clear user and token on logout', () => {
			authStore.logout();
			
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(false);
			expect(state.user).toBeNull();
			expect(state.token).toBeNull();
		});
	});

	describe('Update User', () => {
		beforeEach(() => {
			authStore.login('test-token', mockUser);
		});

		it('should update user data', () => {
			const updatedUser: User = { ...mockUser, fullName: 'Updated Name' };
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.fullName).toBe('Updated Name');
		});

		it('should preserve authentication state when updating user', () => {
			const updatedUser: User = { ...mockUser, fullName: 'Updated' };
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(true);
			expect(state.token).toBe('test-token');
		});
	});

	describe('User Role Checks', () => {
		it('should return true when user is pacient', () => {
			authStore.login('token', { ...mockUser, role: 'pacient' });
			
			const state = get(authStore);
			expect(state.user?.role === 'pacient').toBe(true);
		});

		it('should return false when user is not pacient', () => {
			authStore.login('token', { ...mockUser, role: 'medic' });
			
			const state = get(authStore);
			expect(state.user?.role === 'pacient').toBe(false);
		});
	});

	describe('Gamification', () => {
		it('should handle XP updates', () => {
			authStore.login('token', mockUser);
			const updatedUser = { ...mockUser, totalXp: 200 };
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.totalXp).toBe(200);
		});

		it('should handle streak updates', () => {
			authStore.login('token', mockUser);
			const updatedUser = { ...mockUser, currentStreak: 10 };
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.currentStreak).toBe(10);
		});

		it('should handle badge changes', () => {
			authStore.login('token', mockUser);
			const updatedUser = { ...mockUser, currentBadge: 'silver' };
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.currentBadge).toBe('silver');
		});
	});
});
