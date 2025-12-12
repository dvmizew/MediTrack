import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface User {
	id: number;
	email: string;
	fullName: string;
	role: 'admin' | 'medic' | 'pacient';
	avatarUrl?: string;
	totalXp?: number;
	currentStreak?: number;
	longestStreak?: number;
	currentBadge?: string;
}

export interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
}

const initialState: AuthState = {
	user: browser ? (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null) : null,
	token: browser ? localStorage.getItem('token') : null,
	isAuthenticated: browser ? !!localStorage.getItem('token') : false
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,
		login: (token: string, user: User) => {
			if (browser) {
				localStorage.setItem('token', token);
				localStorage.setItem('user', JSON.stringify(user));
			}
			set({ token, user, isAuthenticated: true });
		},
		logout: () => {
			if (browser) {
				localStorage.removeItem('token');
				localStorage.removeItem('user');
			}
			set({ token: null, user: null, isAuthenticated: false });
		},
		updateUser: (user: User) => {
			update((state) => ({ ...state, user }));
		},
		setToken: (token: string) => {
			if (browser) {
				localStorage.setItem('token', token);
			}
			update((state) => ({ ...state, token }));
		}
	};
}

export const authStore = createAuthStore();

export const isAdmin = derived(authStore, ($auth) => $auth.user?.role === 'admin');
export const isMedic = derived(authStore, ($auth) => $auth.user?.role === 'medic');
export const isPacient = derived(authStore, ($auth) => $auth.user?.role === 'pacient');
