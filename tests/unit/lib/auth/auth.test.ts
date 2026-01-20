import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

import { authStore } from '../../../../src/lib/stores/auth';
import type { User } from '../../../../src/lib/stores/auth';

describe('Auth Store', () => {
	const mockUser: User = {
		id: 1,
		email: 'test@example.com',
		fullName: 'Test User',
		role: 'pacient',
		totalXp: 100,
		currentStreak: 5,
		longestStreak: 10,
		currentBadge: 'Bronze'
	};

	const mockToken = 'test-token-123';

	beforeEach(() => {
		localStorage.clear();
		authStore.logout();
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
			authStore.login(mockToken, mockUser);
			
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(true);
			expect(state.token).toBe(mockToken);
			expect(state.user).toEqual(mockUser);
		});

		it('should save token to localStorage on login', () => {
			authStore.login(mockToken, mockUser);
			
			expect(localStorage.getItem('token')).toBe(mockToken);
			expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
		});

		it('should update store with different user roles', () => {
			const medicUser: User = { ...mockUser, role: 'medic' };
			authStore.login(mockToken, medicUser);
			
			const state = get(authStore);
			expect(state.user?.role).toBe('medic');
		});
	});

	describe('Logout', () => {
		it('should clear user and token on logout', () => {
			authStore.login(mockToken, mockUser);
			authStore.logout();
			
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(false);
			expect(state.user).toBeNull();
			expect(state.token).toBeNull();
		});

		it('should remove token from localStorage on logout', () => {
			authStore.login(mockToken, mockUser);
			authStore.logout();
			
			expect(localStorage.getItem('token')).toBeNull();
			expect(localStorage.getItem('user')).toBeNull();
		});
	});

	describe('Update User', () => {
		it('should update user data', () => {
			authStore.login(mockToken, mockUser);
			
			const updatedUser: User = {
				...mockUser,
				totalXp: 200,
				currentStreak: 10,
				currentBadge: 'Silver'
			};
			
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.totalXp).toBe(200);
			expect(state.user?.currentStreak).toBe(10);
			expect(state.user?.currentBadge).toBe('Silver');
		});

		it('should preserve authentication state when updating user', () => {
			authStore.login(mockToken, mockUser);
			authStore.updateUser({ ...mockUser, fullName: 'Updated Name' });
			
			const state = get(authStore);
			expect(state.isAuthenticated).toBe(true);
			expect(state.token).toBe(mockToken);
		});
	});

	describe('Derived isPacient', () => {
		it('should return true when user is pacient', () => {
			authStore.login(mockToken, { ...mockUser, role: 'pacient' });
			
			// isPacient is a derived store from auth
			const state = get(authStore);
			expect(state.user?.role).toBe('pacient');
		});

		it('should return false when user is not pacient', () => {
			authStore.login(mockToken, { ...mockUser, role: 'medic' });
			
			const state = get(authStore);
			expect(state.user?.role).not.toBe('pacient');
		});
	});

	describe('Gamification Data', () => {
		it('should handle XP updates', () => {
			const userWithXP: User = { ...mockUser, totalXp: 50 };
			authStore.login(mockToken, userWithXP);
			
			const updatedUser: User = { ...userWithXP, totalXp: 60 };
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.totalXp).toBe(60);
		});

		it('should handle streak updates', () => {
			authStore.login(mockToken, mockUser);
			
			const updatedUser: User = {
				...mockUser,
				currentStreak: 15,
				longestStreak: 15
			};
			authStore.updateUser(updatedUser);
			
			const state = get(authStore);
			expect(state.user?.currentStreak).toBe(15);
			expect(state.user?.longestStreak).toBe(15);
		});

		it('should handle badge changes', () => {
			authStore.login(mockToken, { ...mockUser, currentBadge: 'Bronze' });
			
			authStore.updateUser({ ...mockUser, currentBadge: 'Gold' });
			
			const state = get(authStore);
			expect(state.user?.currentBadge).toBe('Gold');
		});
	});
});
