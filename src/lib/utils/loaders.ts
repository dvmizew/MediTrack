import { api } from '$lib/api/client';

export async function loadUserProfile() {
	const profile = await api.getProfile();
	
	return {
		user: profile,
		stats: {
			totalXp: profile.totalXp || profile.nivel_xp || 0,
			currentStreak: profile.currentStreak || profile.current_streak || 0,
			longestStreak: profile.longestStreak || profile.longest_streak || 0,
			currentBadge: profile.currentBadge || profile.current_badge || 'bronze',
			adherenceRate: profile.adherenceRate || profile.adherence_rate || 0,
			totalMedications: profile.totalMedications || profile.total_medications || 0,
			completedTreatments: profile.completedTreatments || profile.completed_treatments || 0,
			activeTreatments: profile.activeTreatments || profile.active_treatments || 0
		}
	};
}

export async function loadCollaborations() {
	const data = await api.getMyCollaborations();
	
	return data.map((c: any) => ({
		...c,
		patientId: c.patientId ?? c.user_id,
		patientName: c.pacientName ?? c.name
	}));
}
