import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';
import { api } from '$lib/api/client';
import { socketClient } from '$lib/api/socket';
import { notificationService } from './notificationService';

/**
 * Session Manager
 * Handles inactivity detection, auto-logout, and token refresh
 */

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes (refresh before expiry)
const WARNING_BEFORE_LOGOUT = 2 * 60 * 1000; // 2 minutes warning

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let warningTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let warningShown = false;

/**
 * Events that indicate user activity
 */
const activityEvents = [
	'mousedown',
	'mousemove',
	'keypress',
	'scroll',
	'touchstart',
	'click'
];

/**
 * Reset inactivity timer
 */
function resetInactivityTimer(): void {
	// Clear existing timers
	if (inactivityTimer) clearTimeout(inactivityTimer);
	if (warningTimer) clearTimeout(warningTimer);
	warningShown = false;

	// Set warning timer (2 minutes before logout)
	warningTimer = setTimeout(() => {
		if (!warningShown) {
			warningShown = true;
			notificationService.warning(
				'Sesiune inactivă',
				'Veți fi deconectat în 2 minute din cauza inactivității',
				10000
			);
		}
	}, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

	// Set inactivity timer (auto-logout)
	inactivityTimer = setTimeout(() => {
		handleAutoLogout();
	}, INACTIVITY_TIMEOUT);
}

/**
 * Handle auto-logout due to inactivity
 */
async function handleAutoLogout(): Promise<void> {
	console.log('Auto-logout due to inactivity');
	
	notificationService.info(
		'Sesiune expirată',
		'Ați fost deconectat din cauza inactivității',
		5000
	);

	// Clear all timers
	stopSessionManager();

	// Disconnect socket
	socketClient.disconnect();

	// Logout user
	authStore.logout();
	
	// Redirect to login
	goto('/');
}

/**
 * Refresh authentication token
 */
async function refreshAuthToken(): Promise<void> {
	try {
		console.log('Refreshing authentication token...');
		const response = await api.refreshToken();
		
		if (response.token && response.user) {
			// Update auth store with new token
			authStore.login(response.token, response.user);
			console.log('Token refreshed successfully');
		}
	} catch (error) {
		console.error('Token refresh failed:', error);
		// If refresh fails, logout user
		notificationService.error(
			'Sesiune expirată',
			'Vă rugăm să vă autentificați din nou',
			5000
		);
		stopSessionManager();
		socketClient.disconnect();
		authStore.logout();
		goto('/');
	}
}

/**
 * Start session manager
 * Initializes inactivity detection and token refresh
 */
export function startSessionManager(): void {
	console.log('Starting session manager...');

	// Reset timer on user activity
	activityEvents.forEach((event) => {
		window.addEventListener(event, resetInactivityTimer, true);
	});

	// Start inactivity timer
	resetInactivityTimer();

	// Start token refresh interval
	refreshTimer = setInterval(() => {
		refreshAuthToken();
	}, TOKEN_REFRESH_INTERVAL);

	// Initial token refresh (optional, to get fresh token on app start)
	// refreshAuthToken();
}

/**
 * Stop session manager
 * Removes all event listeners and clears timers
 */
export function stopSessionManager(): void {
	console.log('Stopping session manager...');

	// Remove event listeners
	activityEvents.forEach((event) => {
		window.removeEventListener(event, resetInactivityTimer, true);
	});

	// Clear timers
	if (inactivityTimer) {
		clearTimeout(inactivityTimer);
		inactivityTimer = null;
	}

	if (warningTimer) {
		clearTimeout(warningTimer);
		warningTimer = null;
	}

	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}

	warningShown = false;
}

/**
 * Manually trigger logout
 * Clears session and redirects to login
 */
export function logout(): void {
	stopSessionManager();
	socketClient.disconnect();
	authStore.logout();
	goto('/');
}

/**
 * Get remaining time until auto-logout (in milliseconds)
 * Useful for displaying countdown timers
 */
export function getRemainingTime(): number {
	// This is an approximation - actual implementation would need to track last activity time
	return INACTIVITY_TIMEOUT;
}

/**
 * Check if session manager is running
 */
export function isSessionManagerActive(): boolean {
	return inactivityTimer !== null || refreshTimer !== null;
}
