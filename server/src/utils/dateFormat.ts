/**
 * Date formatting utilities for Romanian locale
 */

export function formatRoDate(date: string | Date): string {
	return new Date(date).toLocaleDateString('ro-RO');
}

export function formatRoTime(date: string | Date): string {
	return new Date(date).toLocaleTimeString('ro-RO');
}

export function formatRoDateTime(date: string | Date): string {
	return new Date(date).toLocaleString('ro-RO');
}
