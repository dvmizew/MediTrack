/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Generate unique ID for aria-describedby relationships
 */
export function generateAriaId(prefix: string = 'aria'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Trap focus within a container (for modals/dialogs)
 */
export function trapFocus(container: HTMLElement): () => void {
	const focusableElements = container.querySelectorAll<HTMLElement>(
		'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
	);
	
	const firstElement = focusableElements[0];
	const lastElement = focusableElements[focusableElements.length - 1];

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		if (e.shiftKey) {
			// Shift + Tab
			if (document.activeElement === firstElement) {
				e.preventDefault();
				lastElement?.focus();
			}
		} else {
			// Tab
			if (document.activeElement === lastElement) {
				e.preventDefault();
				firstElement?.focus();
			}
		}
	}

	container.addEventListener('keydown', handleKeyDown);
	
	// Focus first element
	firstElement?.focus();

	// Return cleanup function
	return () => {
		container.removeEventListener('keydown', handleKeyDown);
	};
}

/**
 * Announce message to screen readers using live region
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
	let liveRegion = document.getElementById('sr-live-region');
	
	if (!liveRegion) {
		liveRegion = document.createElement('div');
		liveRegion.id = 'sr-live-region';
		liveRegion.className = 'sr-only';
		liveRegion.setAttribute('aria-live', priority);
		liveRegion.setAttribute('aria-atomic', 'true');
		document.body.appendChild(liveRegion);
	}

	// Update aria-live if priority changed
	liveRegion.setAttribute('aria-live', priority);
	
	// Clear and set message (forces announcement)
	liveRegion.textContent = '';
	setTimeout(() => {
		liveRegion!.textContent = message;
	}, 100);
}

/**
 * Get ARIA role for notification type
 */
export function getAriaRoleForNotification(type: string): 'status' | 'alert' {
	switch (type) {
		case 'error':
		case 'warning':
			return 'alert';
		case 'success':
		case 'info':
		default:
			return 'status';
	}
}

/**
 * Format date/time for screen readers
 */
export function formatForScreenReader(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return 'chiar acum';
	if (minutes < 60) return `acum ${minutes} ${minutes === 1 ? 'minut' : 'minute'}`;
	if (hours < 24) return `acum ${hours} ${hours === 1 ? 'oră' : 'ore'}`;
	if (days < 7) return `acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
	
	return date.toLocaleDateString('ro-RO', { 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Check if element is keyboard focusable
 */
export function isFocusable(element: HTMLElement): boolean {
	if (element.hasAttribute('disabled')) return false;
	if (element.hasAttribute('tabindex')) {
		const tabindex = parseInt(element.getAttribute('tabindex') || '0', 10);
		return tabindex >= 0;
	}
	
	const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
	return focusableTags.includes(element.tagName);
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
	const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
	return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Restore focus to previously focused element
 */
export class FocusManager {
	private previousElement: HTMLElement | null = null;

	saveFocus(): void {
		this.previousElement = document.activeElement as HTMLElement;
	}

	restoreFocus(): void {
		if (this.previousElement && isFocusable(this.previousElement)) {
			this.previousElement.focus();
		}
	}

	clearSavedFocus(): void {
		this.previousElement = null;
	}
}

/**
 * Skip to main content (accessibility helper)
 */
export function skipToMainContent(): void {
	const main = document.querySelector('main') || document.querySelector('[role="main"]');
	if (main instanceof HTMLElement) {
		main.setAttribute('tabindex', '-1');
		main.focus();
		main.addEventListener('blur', () => {
			main.removeAttribute('tabindex');
		}, { once: true });
	}
}
