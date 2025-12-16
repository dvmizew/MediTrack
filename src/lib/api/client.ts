import { API_URL } from '../config.js';
import { authStore, type AuthState } from '../stores/auth.js';
import { get } from 'svelte/store';

interface RequestOptions extends RequestInit {
	auth?: boolean;
}

async function request(endpoint: string, options: RequestOptions = {}) {
	const { auth = true, ...fetchOptions } = options;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-cache',
		...(fetchOptions.headers as Record<string, string>)
	};

	if (auth) {
		const { token } = get(authStore);
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
	}

	try {
		// Build URL and add cache-busting param for GET requests
		const method = (fetchOptions.method || 'GET').toUpperCase();
		let url = `${API_URL}${endpoint}`;
		if (method === 'GET') {
			const sep = url.includes('?') ? '&' : '?';
			url = `${url}${sep}ts=${Date.now()}`;
		}

		const response = await fetch(url, {
			...fetchOptions,
			headers,
			cache: 'no-store'
		});

		if (response.status === 401) {
			// Only logout if on login page or token is missing
			const currentAuth: AuthState = get(authStore);
			if (endpoint.startsWith('/auth') || !currentAuth.token) {
				authStore.logout();
				if (typeof window !== 'undefined') {
					window.location.href = '/';
				}
			}
			try {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Unauthorized');
			} catch {
				throw new Error('Unauthorized');
			}
		}

		if (!response.ok) {
			try {
				const error = await response.json();
				throw new Error(error.error || `Request failed with status ${response.status}`);
			} catch (e) {
				if (e instanceof Error) throw e;
				throw new Error(`Request failed with status ${response.status}`);
			}
		}

		try {
			return await response.json();
		} catch (e) {
			console.error('Failed to parse response JSON:', e);
			throw new Error('Invalid response format from server');
		}
	} catch (error) {
		// Network errors or other fetch errors
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Network error');
	}
}

export const api = {
	// Auth
	register: (data: { email: string; password: string; fullName: string; role?: string }) =>
		request('/auth/register', {
			method: 'POST',
			body: JSON.stringify(data),
			auth: false
		}),

	login: (data: { email: string; password: string; deviceToken?: string }) =>
		request('/auth/login', {
			method: 'POST',
			body: JSON.stringify(data),
			auth: false
		}),

	refreshToken: () =>
		request('/auth/refresh-token', {
			method: 'POST'
		}),

	getProfile: () => request('/users/me'),

	updateProfile: (data: { fullName?: string; email?: string; avatarUrl?: string }) =>
		request('/users/me', {
			method: 'PATCH',
			body: JSON.stringify(data)
		}),

	updatePassword: (data: { currentPassword: string; newPassword: string }) =>
		request('/users/me/password', {
			method: 'PATCH',
			body: JSON.stringify(data)
		}),

	// Users (admin)
	getUsers: () => request('/users'),
	getUserProfile: (userId: string) => request(`/users/${userId}`),
	updateUserRole: (userId: number, role: string) =>
		request(`/users/${userId}/role`, {
			method: 'PATCH',
			body: JSON.stringify({ role })
		}),
	toggleUserStatus: (userId: number) =>
		request(`/users/${userId}/status`, { method: 'PATCH' }),

	// Collaborations
	sendInvite: (medicEmail: string) =>
		request('/collaborations/invite', {
			method: 'POST',
			body: JSON.stringify({ medicEmail })
		}),
	getPendingInvites: () => request('/collaborations/pending'),
	respondToInvite: (inviteId: number, action: 'accept' | 'reject') =>
		request(`/collaborations/${inviteId}/respond`, {
			method: 'PATCH',
			body: JSON.stringify({ action })
		}),
	getMyCollaborations: () => request('/collaborations/my'),

	// Treatments
	createTreatment: (data: { pacientId: number; diagnosis: string; description?: string }) =>
		request('/treatments', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	getTreatments: () => request('/treatments'),
	getTreatmentDetails: (planId: number) => request(`/treatments/${planId}`),
	updateTreatment: (planId: number, data: any) =>
		request(`/treatments/${planId}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		}),
	deleteTreatment: (planId: number, confirmToken?: string) =>
		request(`/treatments/${planId}${confirmToken ? `?confirmToken=${encodeURIComponent(confirmToken)}` : ''}`, {
			method: 'DELETE'
		}),

	// Medications (Doses)
	addMedication: (data: {
		planId: number;
		medicationName: string;
		cantitate: string;
		ora: string; // HH:mm
		frecventa: string;
		startDate: string; // ISO date
		endDate?: string;
		instructiuni?: string;
		detaliiMedicament?: string;
	}) =>
		request('/doses', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	getMedicationsForPlan: (planId: number) => request(`/doses/plan/${planId}`),
	updateMedication: (medicationId: number, data: any) =>
		request(`/doses/${medicationId}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		}),
	deleteMedication: (medicationId: number) =>
		request(`/doses/${medicationId}`, {
			method: 'DELETE'
		}),

	// Logs (Confirmations)
	getTodayMedications: () => request('/confirmations/today'),
	confirmMedication: (data: { medicationScheduleId: number; scheduledTime: string }) =>
		request('/confirmations/confirm', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	snoozeMedication: (data: { medicationScheduleId: number; scheduledTime: string }) =>
		request('/confirmations/snooze', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	getMedicationHistory: () => request('/confirmations/history'),
	getMedicationHistoryAdherence: (days: number = 30) =>
		request(`/confirmations/history/adherence?days=${Math.min(days, 365)}`),

	// Notifications
	getNotifications: () => request('/notifications'),
	markNotificationRead: (notificationId: number) =>
		request(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
	markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
	deleteNotification: (notificationId: number) =>
		request(`/notifications/${notificationId}`, { method: 'DELETE' }),
	deleteAllNotifications: () => request('/notifications', { method: 'DELETE' }),
	sendReminder: (userId: number) =>
		request('/notifications/send-reminder', {
			method: 'POST',
			body: JSON.stringify({ userId })
		}),

	// Messages
	sendMessage: (data: { receiverId: number; continut: string }) =>
		request('/messages/send', {
			method: 'POST',
			body: JSON.stringify(data)
		}),
	getConversation: (userId: number) => request(`/messages/conversation/${userId}`),
	getMyConversations: () => request('/messages/conversations'),
	getUserStatus: (userId: number) => request(`/messages/status/${userId}`),
	markMessageAsRead: (messageId: number) =>
		request(`/messages/${messageId}/read`, { method: 'PATCH' }),

	// Leaderboard
	getLeaderboard: (timeFilter?: 'all' | 'month' | 'week') =>
		request(`/leaderboard${timeFilter ? `?filter=${timeFilter}` : ''}`)
};

// MFA API
export const mfaApi = {
	startSetup: () =>
		request('/auth/mfa/setup', {
			method: 'POST',
			auth: true,
		}),
	verifySetup: (secret: string, totpCode: string) =>
		request('/auth/mfa/verify-setup', {
			method: 'POST',
			body: JSON.stringify({ secret, totpCode }),
			auth: true,
		}),
	verifyLogin: (userId: number, totpCode: string, rememberDevice: boolean = false) =>
		request('/auth/login-mfa', {
			method: 'POST',
			body: JSON.stringify({ userId, totpCode, rememberDevice }),
			auth: false,
		}),
	disable: (password: string) =>
		request('/auth/mfa/disable', {
			method: 'POST',
			body: JSON.stringify({ password }),
		}),
	generateBackupCodes: (totpCode: string) =>
		request('/auth/mfa/backup-codes', {
			method: 'POST',
			body: JSON.stringify({ totpCode }),
		}),
};
