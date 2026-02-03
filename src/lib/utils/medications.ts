/**
 * Medication utility functions
 */

/**
 * Check if a medication has been taken
 * @param med - Medication object with result property
 * @returns true if medication marked as taken (result === 'pozitiv')
 */
export function isMedicationTaken(med: any): boolean {
	return med.result === 'pozitiv';
}

/**
 * Check if a medication is currently snoozed
 * @param med - Medication object with snoozedUntil property
 * @param now - Current date/time reference (defaults to now)
 * @returns true if medication is snoozed until a future time
 */
export function isMedicationSnoozed(med: any, now = new Date()): boolean {
	return !isMedicationTaken(med) && med.snoozedUntil && new Date(med.snoozedUntil) > now;
}

/**
 * Get the effective scheduled time for a medication
 * - Returns null if already taken
 * - Returns snooze time if currently snoozed
 * - Returns scheduled time from med.time if pending
 * @param med - Medication object with time and snoozedUntil properties
 * @param now - Current date/time reference (defaults to now)
 * @returns Scheduled Date or null if taken
 */
export function getMedicationScheduledTime(med: any, now = new Date()): Date | null {
	if (isMedicationTaken(med)) return null;
	if (isMedicationSnoozed(med, now)) {
		return new Date(med.snoozedUntil);
	}
	if (!med.time) return null;
	const [hours, minutes] = String(med.time).split(':').map(Number);
	const scheduled = new Date();
	scheduled.setHours(hours, minutes, 0, 0);
	return scheduled;
}
