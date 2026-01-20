function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16)
		  }
		: null;
}

function getLuminance(r: number, g: number, b: number): number {
	const [rs, gs, bs] = [r, g, b].map((c) => {
		const sRGB = c / 255;
		return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(color1: string, color2: string): number {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	if (!rgb1 || !rgb2) return 0;

	const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
	const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);

	return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
	return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

export function meetsWCAGAAA(ratio: number, isLargeText: boolean = false): boolean {
	return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

export const colorPairsToCheck = [
	// Light mode
	{ fg: '#111827', bg: '#FFFFFF', context: 'Light mode - Primary text on white' },
	{ fg: '#374151', bg: '#F9FAFB', context: 'Light mode - Secondary text on gray-50' },
	{ fg: '#4B5563', bg: '#FFFFFF', context: 'Light mode - Tertiary text on white' },
	{ fg: '#2563EB', bg: '#FFFFFF', context: 'Light mode - Blue links on white' },
	{ fg: '#FFFFFF', bg: '#2563EB', context: 'Light mode - White text on blue button' },
	{ fg: '#B91C1C', bg: '#FEF2F2', context: 'Light mode - Error text on error bg' },
	{ fg: '#047857', bg: '#F0FDF4', context: 'Light mode - Success text on success bg' },
	{ fg: '#B45309', bg: '#FFFBEB', context: 'Light mode - Warning text on warning bg' },
	
	// Dark mode
	{ fg: '#F9FAFB', bg: '#111827', context: 'Dark mode - Primary text on gray-900' },
	{ fg: '#E5E7EB', bg: '#1F2937', context: 'Dark mode - Secondary text on gray-800' },
	{ fg: '#9CA3AF', bg: '#111827', context: 'Dark mode - Tertiary text on gray-900' },
	{ fg: '#60A5FA', bg: '#111827', context: 'Dark mode - Blue links on gray-900' },
	{ fg: '#FFFFFF', bg: '#1D4ED8', context: 'Dark mode - White text on blue button' },
	{ fg: '#FCA5A5', bg: '#7F1D1D', context: 'Dark mode - Error text on error bg' },
	{ fg: '#6EE7B7', bg: '#064E3B', context: 'Dark mode - Success text on success bg' },
	{ fg: '#FCD34D', bg: '#78350F', context: 'Dark mode - Warning text on warning bg' }
];

export function validateColorContrast(): Array<{
	context: string;
	ratio: number;
	meetsAA: boolean;
	meetsAAA: boolean;
	status: 'pass' | 'fail';
}> {
	return colorPairsToCheck.map(({ fg, bg, context }) => {
		const ratio = getContrastRatio(fg, bg);
		const meetsAA = meetsWCAGAA(ratio);
		const meetsAAA = meetsWCAGAAA(ratio);
		
		return {
			context,
			ratio: parseFloat(ratio.toFixed(2)),
			meetsAA,
			meetsAAA,
			status: meetsAA ? 'pass' : 'fail'
		};
	});
}
