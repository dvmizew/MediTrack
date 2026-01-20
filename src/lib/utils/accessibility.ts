export function isFocusable(element: HTMLElement): boolean {
	if (element.hasAttribute('disabled')) return false;
	if (element.hasAttribute('tabindex')) {
		const tabindex = parseInt(element.getAttribute('tabindex') || '0', 10);
		return tabindex >= 0;
	}
	
	const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
	return focusableTags.includes(element.tagName);
}

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