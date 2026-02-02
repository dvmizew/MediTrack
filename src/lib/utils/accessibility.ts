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

/**
 * Announce message to screen readers using live region
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
if (typeof document === 'undefined') return;

const announcement = document.createElement('div');
announcement.setAttribute('role', 'status');
announcement.setAttribute('aria-live', priority);
announcement.setAttribute('aria-atomic', 'true');
announcement.className = 'sr-only';
announcement.textContent = message;

document.body.appendChild(announcement);

setTimeout(() => {
if (document.body.contains(announcement)) {
document.body.removeChild(announcement);
}
}, 1000);
}

/**
 * Generate unique ID for ARIA attributes
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
return `${prefix}-${Date.now()}-${++idCounter}`;
}

/**
 * Calculate contrast ratio between two colors using WCAG formula
 * @param color1 - RGB color [r, g, b] with values 0-255
 * @param color2 - RGB color [r, g, b] with values 0-255
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: number[], color2: number[]): number {
const l1 = getRelativeLuminance(color1);
const l2 = getRelativeLuminance(color2);

const lighter = Math.max(l1, l2);
const darker = Math.min(l1, l2);

return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(rgb: number[]): number {
const [r, g, b] = rgb.map(val => {
val = val / 255;
return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
});

return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Check if contrast meets WCAG AAA standard
 * @param ratio - Contrast ratio
 * @param isLargeText - Text is 18pt+ or 14pt+ bold
 * @returns true if meets AAA (7:1 normal, 4.5:1 large)
 */
export function meetsWCAG_AAA(ratio: number, isLargeText: boolean = false): boolean {
return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Check if contrast meets WCAG AA standard
 * @param ratio - Contrast ratio
 * @param isLargeText - Text is 18pt+ or 14pt+ bold
 * @returns true if meets AA (4.5:1 normal, 3:1 large)
 */
export function meetsWCAG_AA(ratio: number, isLargeText: boolean = false): boolean {
return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Common color values for contrast checking
 */
export const COLORS = {
// Slate palette (dark theme)
slate900: [15, 23, 42],
slate800: [30, 41, 59],
slate700: [51, 65, 85],
slate300: [203, 213, 225],
slate100: [241, 245, 249],

// Blue palette
blue600: [37, 99, 235],
blue400: [96, 165, 250],

// White/Black
white: [255, 255, 255],
black: [0, 0, 0],

// Green
green600: [22, 163, 74],
green400: [74, 222, 128],
};

/**
 * Test if current color scheme meets WCAG AAA for all text
 */
export function validateColorScheme(): {
lightMode: boolean;
darkMode: boolean;
issues: string[];
} {
const issues: string[] = [];

// Light mode checks
const lightBgText = getContrastRatio(COLORS.white, COLORS.black);
const lightModeOk = meetsWCAG_AAA(lightBgText);

// Dark mode checks  
const darkBgText = getContrastRatio(COLORS.slate900, COLORS.slate100);
const darkSecondaryText = getContrastRatio(COLORS.slate900, COLORS.slate300);

if (!lightModeOk) {
issues.push('Light mode text contrast below AAA');
}

if (!meetsWCAG_AAA(darkBgText)) {
issues.push(`Dark mode primary text: ${darkBgText.toFixed(2)}:1 (needs 7:1)`);
}

if (!meetsWCAG_AAA(darkSecondaryText)) {
issues.push(`Dark mode secondary text: ${darkSecondaryText.toFixed(2)}:1 (needs 7:1)`);
}

return {
lightMode: lightModeOk,
darkMode: meetsWCAG_AAA(darkBgText) && meetsWCAG_AAA(darkSecondaryText),
issues
};
}
