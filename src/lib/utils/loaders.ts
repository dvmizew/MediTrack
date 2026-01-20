import { api } from '$lib/api/client';

/**
 * Load current user profile with stats
 * Reusable across profile and settings pages
 */
export async function loadUserProfile() {
	const profile = await api.getProfile();
	
	return {
		user: profile,
		stats: {
			totalXp: profile.totalXp || profile.nivel_xp || 0,
			currentStreak: profile.currentStreak || profile.current_streak || 0,
			longestStreak: profile.longestStreak || profile.longest_streak || 0,
			currentBadge: profile.currentBadge || profile.current_badge || 'bronze',
			completedTreatments: 0,
			activeTreatments: 0
		}
	};
}

/**
 * Load collaborations for current user
 * Normalizes patient data from doctor_patient table
 */
export async function loadCollaborations() {
	const data = await api.getMyCollaborations();
	
	return data.map((c: any) => ({
		...c,
		patientId: c.patientId ?? c.user_id,
		patientName: c.pacientName ?? c.name
	}));
}
