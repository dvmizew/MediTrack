import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';
import { api } from '$lib/api/client';
import { socketClient } from '$lib/api/socket';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000;
const WARNING_BEFORE_LOGOUT = 2 * 60 * 1000;

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let warningTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let warningShown = false;

const activityEvents = [
	'mousedown',
	'mousemove',
	'keypress',
	'scroll',
	'touchstart',
	'click'
];

function resetInactivityTimer(): void {
	if (inactivityTimer) clearTimeout(inactivityTimer);
	if (warningTimer) clearTimeout(warningTimer);
	warningShown = false;

	warningTimer = setTimeout(() => {
		if (!warningShown) {
			warningShown = true;
			console.warn('Sesiune inactivă: deconectare în 2 minute');
		}
	}, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

	inactivityTimer = setTimeout(() => {
		handleAutoLogout();
	}, INACTIVITY_TIMEOUT);
}

async function handleAutoLogout(): Promise<void> {
	stopSessionManager();

	socketClient.disconnect();

	authStore.logout();
	
	goto('/');
}

async function refreshAuthToken(): Promise<void> {
	try {
		const response = await api.refreshToken();
		
		if (response.token && response.user) {
			authStore.login(response.token, response.user);
		}
	} catch (error) {
		console.error('Token refresh failed:', error);
		stopSessionManager();
		socketClient.disconnect();
		authStore.logout();
		goto('/');
	}
}

export function startSessionManager(): void {
	activityEvents.forEach((event) => {
		window.addEventListener(event, resetInactivityTimer, true);
	});

	resetInactivityTimer();

	refreshTimer = setInterval(() => {
		refreshAuthToken();
	}, TOKEN_REFRESH_INTERVAL);
}

export function stopSessionManager(): void {
	activityEvents.forEach((event) => {
		window.removeEventListener(event, resetInactivityTimer, true);
	});

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

export function logout(): void {
	stopSessionManager();
	socketClient.disconnect();
	authStore.logout();
	goto('/');
}

export function getRemainingTime(): number {
	return INACTIVITY_TIMEOUT;
}

export function isSessionManagerActive(): boolean {
	return inactivityTimer !== null || refreshTimer !== null;
}
