import { browser } from '$app/environment';
import { toastStore } from '../stores/notifications';

export interface NotificationOptions {
	title: string;
	message: string;
	type?: 'success' | 'error' | 'warning' | 'info';
	duration?: number;
	sound?: boolean;
	vibrate?: boolean;
}

export interface PushNotificationOptions extends NotificationOptions {
	icon?: string;
	badge?: string;
	url?: string;
	tag?: string;
}

class NotificationService {
	private soundEnabled = true;
	private vibrationSupported = 'vibrate' in navigator;
	private pushNotificationSupported = 'serviceWorker' in navigator && 'Notification' in window;
	private userInteracted = false;

	constructor() {
		// Track user interaction for autoplay policy compliance
		if (browser) {
			this.setupUserInteractionTracking();
		}
		
		// Preload notification sounds if user interacts
		this.setupAudioPreload();
	}

	/**
	 * Track user interaction to bypass autoplay policy restrictions
	 */
	private setupUserInteractionTracking() {
		const markInteraction = () => {
			this.userInteracted = true;
			document.removeEventListener('click', markInteraction);
			document.removeEventListener('keydown', markInteraction);
			document.removeEventListener('touchstart', markInteraction);
		};

		document.addEventListener('click', markInteraction, { once: true });
		document.addEventListener('keydown', markInteraction, { once: true });
		document.addEventListener('touchstart', markInteraction, { once: true });
	}

	/**
	 * Preload audio context and notification sounds on first user interaction
	 */
	private setupAudioPreload() {
		if (!browser) return;
		
		if (!this.userInteracted) {
			// Wait for user interaction, then preload audio
			const checkInteraction = setInterval(() => {
				if (this.userInteracted) {
					clearInterval(checkInteraction);
					this.preloadAudio();
				}
			}, 100);
			// Clear interval after 10 seconds to prevent memory leak
			setTimeout(() => clearInterval(checkInteraction), 10000);
		}
	}

	/**
	 * Preload notification sounds for smooth playback
	 */
	private preloadAudio() {
		if (typeof Audio === 'undefined') return;

		// Initialize audio context if available
		try {
			const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			this.audioContext = audioContext;
		} catch (e) {
			console.warn('AudioContext not available:', e);
		}

		// Preload silent audio to establish audio playback permission
		try {
			const silentAudio = new Audio();
			silentAudio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
			silentAudio.volume = 0;
			silentAudio.play().catch(() => {
				// Autoplay policy restricts playback - will use on first user interaction
			});
		} catch (e) {
			// Ignore preload errors
		}
	}

	/**
	 * Show a toast notification
	 */
	showToast(options: NotificationOptions) {
		const duration = options.duration ?? (options.type === 'error' ? 6000 : 4000);

		toastStore.add({
			type: options.type ?? 'info',
			title: options.title,
			message: options.message,
			duration: duration > 0 ? duration : undefined
		});

		if (options.sound !== false && this.userInteracted) {
			this.playSound(options.type ?? 'info');
		}

		if (options.vibrate !== false && this.vibrationSupported && this.userInteracted) {
			this.vibrate(options.type ?? 'info');
		}
	}

	/**
	 * Show success toast
	 */
	success(title: string, message: string, duration?: number) {
		this.showToast({ type: 'success', title, message, duration, sound: true });
	}

	/**
	 * Show error toast
	 */
	error(title: string, message: string, duration?: number) {
		this.showToast({ type: 'error', title, message, duration: duration ?? 6000, sound: true });
	}

	/**
	 * Show warning toast
	 */
	warning(title: string, message: string, duration?: number) {
		this.showToast({ type: 'warning', title, message, duration: duration ?? 5000, sound: true });
	}

	/**
	 * Show info toast
	 */
	info(title: string, message: string, duration?: number) {
		this.showToast({ type: 'info', title, message, duration: duration ?? 4000, sound: false });
	}

	/**
	 * Play notification sound with proper autoplay policy compliance
	 */
	private playSound(type: 'success' | 'error' | 'warning' | 'info') {
		if (typeof Audio === 'undefined' || !this.userInteracted) return;

		try {
			const audio = new Audio();
			const volumes: Record<string, number> = {
				success: 0.2,
				error: 0.3,
				warning: 0.25,
				info: 0.15
			};

			audio.volume = volumes[type] ?? 0.2;

			// Use same audio sources as ToastContainer
			const soundMap: Record<string, string> = {
				success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c',
				error: 'data:audio/wav;base64,UklGRjYGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAP+BAf7/gf+B/4H/gf+B/4H/gf+B//8=',
				warning: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c',
				info: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c'
			};

			audio.src = soundMap[type] || soundMap.info;
			audio.play().catch((err) => {
				// Log but don't throw - autoplay may be restricted
				console.debug('Sound playback failed (expected in some cases):', err.message);
			});
		} catch (e) {
			console.debug('Sound playback error:', e);
		}
	}

	/**
	 * Trigger vibration feedback
	 */
	private vibrate(type: 'success' | 'error' | 'warning' | 'info') {
		if (!this.vibrationSupported) return;

		const patterns: Record<string, number | number[]> = {
			success: [50, 100, 50],
			error: [100, 50, 100, 50, 100],
			warning: [100, 50, 100],
			info: 50
		};

		try {
			navigator.vibrate(patterns[type] || 50);
		} catch (e) {
			console.debug('Vibration failed:', e);
		}
	}

	/**
	 * Request push notification permission
	 */
	async requestPushPermission(): Promise<boolean> {
		if (!this.pushNotificationSupported) {
			console.warn('Push notifications not supported');
			return false;
		}

		try {
			const permission = await Notification.requestPermission();
			return permission === 'granted';
		} catch (error) {
			console.error('Failed to request notification permission:', error);
			return false;
		}
	}

	/**
	 * Show browser push notification
	 */
	async showPushNotification(options: PushNotificationOptions) {
		if (!this.pushNotificationSupported) {
			// Fallback to toast
			this.showToast(options);
			return;
		}

		if (Notification.permission !== 'granted') {
			// Fallback to toast if permission not granted
			this.showToast(options);
			return;
		}

		try {
			const notification = new Notification(options.title, {
				body: options.message,
				icon: options.icon || '/icon-192.png',
				badge: options.badge || '/icon-192.png',
				tag: options.tag || 'notification',
				vibrate: options.vibrate !== false ? [200, 100, 200] : undefined,
				silent: options.sound === false,
				data: {
					url: options.url || '/dashboard',
					type: options.type
				}
			});

			// Click handler
			notification.onclick = () => {
				if (browser) {
					window.focus();
					window.open(options.url || '/dashboard', '_self');
				}
				notification.close();
			};

			// Close handler
			notification.onclose = () => {
				console.debug('Notification closed');
			};

			// Error handler
			notification.onerror = () => {
				console.error('Notification error');
			};
		} catch (error) {
			console.error('Failed to show push notification:', error);
			// Fallback to toast
			this.showToast(options);
		}
	}

	/**
	 * Subscribe to push notifications via service worker
	 */
	async subscribeToPushNotifications(): Promise<boolean> {
		if (!('serviceWorker' in navigator)) {
			console.warn('Service Workers not supported');
			return false;
		}

		try {
			// Request permission first
			const hasPermission = await this.requestPushPermission();
			if (!hasPermission) {
				console.warn('Push notification permission denied');
				return false;
			}

			// Get service worker registration
			const registration = await navigator.serviceWorker.ready;

			// Check if already subscribed
			let subscription = await registration.pushManager.getSubscription();
			if (subscription) {
				console.log('Already subscribed to push notifications');
				return true;
			}

			// Subscribe to push notifications
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: this.urlBase64ToUint8Array(process.env.PUBLIC_VAPID_PUBLIC_KEY || '')
			});

			console.log('Subscribed to push notifications');
			return true;
		} catch (error) {
			console.error('Failed to subscribe to push notifications:', error);
			return false;
		}
	}

	/**
	 * Convert VAPID key from base64
	 */
	private urlBase64ToUint8Array(base64String: string): Uint8Array {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

		// Use globalThis for cross-environment compatibility
		const atob = typeof window !== 'undefined' ? window.atob : (str: string) => {
			return Buffer.from(str, 'base64').toString('binary');
		};
		
		const rawData = atob(base64);
		const outputArray = new Uint8Array(rawData.length);

		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}

		return outputArray;
	}

	/**
	 * Check if sound is enabled
	 */
	isSoundEnabled(): boolean {
		return this.soundEnabled && this.userInteracted;
	}

	/**
	 * Toggle sound on/off
	 */
	toggleSound(): void {
		this.soundEnabled = !this.soundEnabled;
		if (this.soundEnabled) {
			this.preloadAudio();
		}
	}

	/**
	 * Check if notifications are supported
	 */
	isNotificationsSupported(): boolean {
		return this.pushNotificationSupported;
	}

	/**
	 * Get current permission status
	 */
	getPermissionStatus(): NotificationPermission {
		return Notification.permission ?? 'default';
	}
}

// Export singleton instance
export const notificationService = new NotificationService();
